import React, { useState } from 'react';
import { Equipment, EquipmentStoppage, StoppageReasonType, StoppageStatus, User } from '../../../types';
import { X, Save, Trash2, Loader2, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { FormInput } from '../../../components/ui/FormInput';
import { FormTextarea } from '../../../components/ui/FormTextarea';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { EquipmentSelector } from '../../../components/EquipmentSelector';
import { STOPPAGE_REASON_CONFIG, STOPPAGE_STATUS_CONFIG } from '../../../constants';
import { toast } from 'sonner';

interface StoppageFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    stoppage: EquipmentStoppage | null;
    equipment: Equipment[];
    currentUser: User | null;
    canManage: boolean;
    initialEquipmentId?: string;
    initialStartAt?: string;
    onCreate: (data: Partial<EquipmentStoppage>) => Promise<unknown>;
    onUpdate: (id: string, updates: Partial<EquipmentStoppage>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const StoppageFormModal: React.FC<StoppageFormModalProps> = ({
    isOpen, onClose, stoppage, equipment, currentUser, canManage,
    initialEquipmentId, initialStartAt,
    onCreate, onUpdate, onDelete
}) => {
    const [title, setTitle] = useState('');
    const [equipmentId, setEquipmentId] = useState('');
    const [reasonType, setReasonType] = useState<StoppageReasonType>(StoppageReasonType.MAINTENANCE);
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setTitle(stoppage?.title || '');
            setEquipmentId(stoppage?.equipmentId || initialEquipmentId || '');
            setReasonType(stoppage?.reasonType || StoppageReasonType.MAINTENANCE);
            setStartAt(toLocalInput(stoppage?.startAt || initialStartAt || new Date().toISOString()));
            const defaultEnd = stoppage?.endAt
                || (initialStartAt ? new Date(new Date(initialStartAt).getTime() + 2 * 3600 * 1000).toISOString() : '');
            setEndAt(toLocalInput(defaultEnd));
            setDescription(stoppage?.description || '');
        }
    }, [isOpen, stoppage, initialEquipmentId, initialStartAt]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !equipmentId || !startAt) {
            toast.error('Completa los campos obligatorios');
            return;
        }
        // endAt puede quedar vacío: parada abierta (duración desconocida).
        if (endAt && new Date(endAt) <= new Date(startAt)) {
            toast.error('El fin debe ser posterior al inicio');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                title: title.trim(),
                equipmentId,
                reasonType,
                startAt: new Date(startAt).toISOString(),
                endAt: endAt ? new Date(endAt).toISOString() : null,
                description: description.trim() || null
            };
            if (stoppage) {
                await onUpdate(stoppage.id, payload);
            } else {
                await onCreate({
                    ...payload,
                    status: StoppageStatus.SCHEDULED,
                    requestedBy: currentUser?.id,
                    createdBy: currentUser?.id
                });
            }
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatus = async (status: StoppageStatus) => {
        if (!stoppage) return;
        try {
            await onUpdate(stoppage.id, { status });
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async () => {
        if (!stoppage) return;
        if (!window.confirm(`¿Eliminar la parada "${stoppage.title}"?`)) return;
        try {
            await onDelete(stoppage.id);
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    const statusConfig = stoppage ? STOPPAGE_STATUS_CONFIG[stoppage.status] : null;

    return (
        <Modal onClose={onClose}>
            <Modal.Header onClose={onClose}>
                {stoppage ? 'Detalle de Parada' : 'Nueva Parada Programada'}
            </Modal.Header>

            <Modal.Body>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {stoppage && statusConfig && (
                        <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusConfig.bgClass}`}>
                                {statusConfig.label}
                            </span>
                            {stoppage.requestedByName && (
                                <span className="text-xs text-slate-400">Solicitada por {stoppage.requestedByName}</span>
                            )}
                        </div>
                    )}

                    <FormInput
                        label="Título *"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Cambio de variador en torno 3"
                        required
                        disabled={!canManage}
                    />

                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Equipo *</label>
                        <EquipmentSelector
                            equipment={equipment}
                            selectedId={equipmentId}
                            onSelect={setEquipmentId}
                            placeholder="Selecciona el equipo que se parará..."
                            disabled={!canManage}
                        />
                    </div>

                    {stoppage?.incidentId ? (
                        // El motivo lo aporta la categoría de la incidencia: no se edita aquí.
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Motivo de la parada</label>
                            <div className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 text-sm">
                                {stoppage.reasonLabel || '—'}
                                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">de la incidencia</span>
                            </div>
                        </div>
                    ) : (
                        <CustomSelect
                            label="Motivo de la parada *"
                            value={reasonType}
                            onChange={(val) => setReasonType(val as StoppageReasonType)}
                            options={Object.values(StoppageReasonType).map(r => ({
                                value: r,
                                label: STOPPAGE_REASON_CONFIG[r].label
                            }))}
                            disabled={!canManage}
                        />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Inicio *</label>
                            <input
                                type="datetime-local"
                                required
                                value={startAt}
                                onChange={(e) => setStartAt(e.target.value)}
                                disabled={!canManage}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Fin *</label>
                            <input
                                type="datetime-local"
                                required
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                disabled={!canManage}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <FormTextarea
                        label="Descripción"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        disabled={!canManage}
                        placeholder="Detalles de la intervención, empresa externa, materiales necesarios..."
                    />

                    {canManage && (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                            {stoppage ? (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Trash2 size={16} />
                                    Eliminar
                                </button>
                            ) : <span />}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {stoppage ? 'Guardar Cambios' : 'Programar Parada'}
                            </button>
                        </div>
                    )}
                </form>

                {stoppage && canManage && stoppage.status !== StoppageStatus.COMPLETED && stoppage.status !== StoppageStatus.CANCELLED && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {stoppage.status === StoppageStatus.SCHEDULED && (
                            <button
                                onClick={() => handleStatus(StoppageStatus.IN_PROGRESS)}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                            >
                                <PlayCircle size={16} />
                                Iniciar Parada
                            </button>
                        )}
                        <button
                            onClick={() => handleStatus(StoppageStatus.COMPLETED)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                        >
                            <CheckCircle2 size={16} />
                            Completar
                        </button>
                        <button
                            onClick={() => handleStatus(StoppageStatus.CANCELLED)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                        >
                            <XCircle size={16} />
                            Cancelar
                        </button>
                    </div>
                )}
            </Modal.Body>

            {!canManage && (
                <Modal.Footer>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
                    >
                        <X size={16} />
                        Cerrar
                    </button>
                </Modal.Footer>
            )}
        </Modal>
    );
};
