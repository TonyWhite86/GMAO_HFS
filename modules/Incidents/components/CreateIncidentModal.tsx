import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Camera, Check, Loader2, AlertCircle, FileText, X, Plus } from 'lucide-react';
import { IncidentStatus, WOPriority, Attachment, UserRole } from '../../../types';
import { EquipmentSelector } from '../../../components/EquipmentSelector';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { toast } from 'sonner';
import { Modal } from '../../../components/ui/Modal';
import { FormInput } from '../../../components/ui/FormInput';
import { FormTextarea } from '../../../components/ui/FormTextarea';
import { useFileUpload } from '../../../hooks/useFileUpload';
import { useVisibleCategories } from '../../../hooks/useVisibleCategories';
import { VoiceInputButton } from '../../../components/ui/VoiceInputButton';

interface CreateIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreateIncidentModal: React.FC<CreateIncidentModalProps> = ({ isOpen, onClose }) => {
    const { currentUser, sections, equipment, addIncidentWithStoppage } = useAppStore();

    const visibleCategories = useVisibleCategories(currentUser);
    const activeCategories = React.useMemo(
        () => visibleCategories.filter(c => c.isActive),
        [visibleCategories]
    );
    const defaultCategoryId = React.useMemo(
        () => activeCategories.find(c => c.isDefault)?.id || activeCategories[0]?.id || '',
        [activeCategories]
    );

    // Sección: vacía por defecto = la incidencia la ve todo el mundo. Si se
    // acota, solo se puede elegir entre las secciones propias del usuario
    // (el Admin puede elegir cualquiera).
    const sectionOptions = React.useMemo(() => {
        const names = currentUser?.role === UserRole.ADMIN
            ? sections.map(s => s.name)
            : (currentUser?.sections || []);
        return [
            { value: '', label: 'Sin sección — la ve todo el mundo' },
            ...names.map(n => ({ value: n, label: n }))
        ];
    }, [currentUser, sections]);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: WOPriority.MEDIUM,
        categoryId: defaultCategoryId,
        section: '',
        equipmentId: ''
    });

    // Las categorías cargan de forma asíncrona o cambian de visibilidad: si la
    // seleccionada ya no es válida, volvemos a la categoría por defecto.
    useEffect(() => {
        if (activeCategories.length === 0) return;
        const stillValid = activeCategories.some(c => c.id === formData.categoryId);
        if (!stillValid) {
            setFormData(prev => ({ ...prev, categoryId: defaultCategoryId }));
        }
    }, [activeCategories, formData.categoryId, defaultCategoryId]);

    // Parada de equipo opcional: se puede registrar a la vez que la incidencia.
    // La duración se desconoce al crearla (end_at queda NULL).
    const [withStoppage, setWithStoppage] = useState(false);
    const [stoppageStartAt, setStoppageStartAt] = useState<string>(() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    const [stoppageDescription, setStoppageDescription] = useState('');

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const { uploadFiles, removeFile, isUploading } = useFileUpload();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleCancel = async () => {
        // Cleanup orphaned files
        if (attachments.length > 0) {
            for (const att of attachments) {
                await removeFile(att.url, 'work-order-files');
            }
        }
        onClose();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            try {
                const newAttachments = await uploadFiles(e.target.files, 'work-order-files', 'incidents');
                setAttachments(prev => [...prev, ...newAttachments]);
            } catch (error) {
                // Toast handled in hook
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const removeAttachment = async (idx: number) => {
        const att = attachments[idx];
        await removeFile(att.url, 'work-order-files');
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim() || !formData.description.trim() || !formData.categoryId || !formData.equipmentId || isSubmitting) {
            toast.error('Por favor, completa los campos obligatorios');
            return;
        }

        setIsSubmitting(true);
        try {
            // created_by lo asigna la BD (DEFAULT auth.uid()); el RLS lo exige.
            // Si se pide parada, se crea en la MISMA transacción (RPC).
            await addIncidentWithStoppage({
                title: formData.title,
                description: formData.description,
                priority: formData.priority,
                categoryId: formData.categoryId,
                section: formData.section || null,
                equipmentId: formData.equipmentId || null,
                attachments,
                withStoppage: withStoppage && !!formData.equipmentId,
                stoppageTitle: formData.title,
                stoppageStartAt: stoppageStartAt ? new Date(stoppageStartAt).toISOString() : null,
                stoppageDescription: stoppageDescription || null
            });

            onClose();
            // Reset form
            setFormData({
                title: '',
                description: '',
                priority: WOPriority.MEDIUM,
                categoryId: defaultCategoryId,
                section: '',
                equipmentId: ''
            });
            setWithStoppage(false);
            setStoppageDescription('');
            setAttachments([]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal onClose={handleCancel}>
            <Modal.Header
                onClose={handleCancel}
                icon={<AlertCircle size={24} className="text-amber-500" />}
            >
                Reportar Nueva Incidencia
            </Modal.Header>

            <Modal.Body>
                <form id="create-incident-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* Category, Section & Priority Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <CustomSelect
                                label="Categoría *"
                                value={formData.categoryId}
                                onChange={(val) => setFormData({ ...formData, categoryId: val })}
                                options={activeCategories.map(c => ({ value: c.id, label: c.name }))}
                            />
                        </div>
                        <div>
                            <CustomSelect
                                label="Sección"
                                value={formData.section}
                                onChange={(val) => setFormData({ ...formData, section: val })}
                                options={sectionOptions}
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                                Sin sección = la ve todo el mundo. Al elegir una, solo la ve esa sección.
                            </p>
                        </div>
                        <div>
                            <CustomSelect
                                label="Prioridad *"
                                value={formData.priority}
                                onChange={(val) => setFormData({ ...formData, priority: val as WOPriority })}
                                options={Object.values(WOPriority).map(p => ({ value: p, label: p }))}
                            />
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <FormInput
                            label="Título de la Incidencia *"
                            placeholder="Ej. Fuga de agua en manguera de presión"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    {/* Equipment Selector (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Equipo Relacionado *</label>
                        <EquipmentSelector
                            equipment={equipment}
                            selectedId={formData.equipmentId}
                            onSelect={(id) => setFormData({ ...formData, equipmentId: id })}
                            placeholder="Selecciona el equipo si lo conoces..."
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Detalles del problema *</label>
                            <VoiceInputButton
                                onTranscript={(text) => setFormData(prev => ({ ...prev, description: prev.description ? prev.description + ' ' + text : text }))}
                            />
                        </div>
                        <FormTextarea
                            placeholder="Describe lo que sucede, sonidos extraños, si ha parado la producción, etc."
                            rows={4}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                        />
                    </div>

                    {/* Parada de equipo (opcional) */}
                    {(
                        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-900/10 p-4 space-y-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={withStoppage}
                                    onChange={(e) => setWithStoppage(e.target.checked)}
                                    className="mt-1 rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                                />
                                <span>
                                    <span className="block text-sm font-bold text-amber-900 dark:text-amber-200">
                                        Este equipo está parado ahora mismo
                                    </span>
                                    <span className="block text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                                        Registra la parada junto a la incidencia. La duración se apuntará
                                        cuando el equipo vuelva a estar operativo.
                                    </span>
                                </span>
                            </label>

                            {withStoppage && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Inicio de la parada *</label>
                                        <input
                                            type="datetime-local"
                                            value={stoppageStartAt}
                                            onChange={(e) => setStoppageStartAt(e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <p className="text-xs text-amber-700/80 dark:text-amber-400/80 pb-2">
                                            El motivo de la parada es el de la categoría de la incidencia.
                                        </p>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <FormTextarea
                                            label="Detalles de la parada"
                                            rows={2}
                                            value={stoppageDescription}
                                            onChange={(e) => setStoppageDescription(e.target.value)}
                                            placeholder="Qué se ha parado, parte de la máquina afectada, materiales previstos..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Attachments */}
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <Camera size={16} />
                            Fotos o Documentos
                        </label>

                        <div className="flex flex-wrap gap-3">
                            {attachments.map((att, idx) => (
                                <div key={idx} className="relative group w-20 h-20 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-700 shadow-sm animate-in zoom-in-75">
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileText size={24} className="text-slate-300" />
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(idx)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all gap-1"
                            >
                                {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
                                <span className="text-[10px] font-bold">Añadir</span>
                            </button>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            accept="image/*,video/*,application/pdf"
                            onChange={handleFileChange}
                        />
                    </div>
                </form>
            </Modal.Body>

            <Modal.Footer>
                <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2.5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploading}
                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-600/25 transition-all active:scale-95 flex items-center gap-2"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    Enviar Incidencia
                </button>
            </Modal.Footer>
        </Modal>
    );
};
