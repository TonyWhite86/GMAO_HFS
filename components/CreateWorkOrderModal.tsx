import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Mic, Loader2, Paperclip, FileText, UserPlus, Plus, Trash2, UploadCloud, ClipboardList, User as UserIcon, Users, X } from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { WorkOrder, WOPriority, WOType, WOStatus, User, UserRole, Attachment, SubTask, Section, Equipment } from '../types';
import { EquipmentSelector } from './EquipmentSelector';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { compressImage } from '../utils/compressImage';
import { Modal } from './ui/Modal';
import { FormInput } from './ui/FormInput';
import { FormTextarea } from './ui/FormTextarea';
import { useFileUpload } from '../hooks/useFileUpload';
import { usePermissions } from '../hooks/usePermissions';
import { VoiceInputButton } from './ui/VoiceInputButton';

interface CreateModalProps {
    onClose: () => void;
    onSubmit: (wo: WorkOrder) => void;
    users: User[];
    currentUser: User;
    equipment: Equipment[];
    sections: Section[];
    existingWorkOrders: WorkOrder[];
    initialEquipmentId?: string;
    initialType?: WOType;
}

export const CreateWorkOrderModal: React.FC<CreateModalProps> = ({ onClose, onSubmit, users, currentUser, equipment, sections, existingWorkOrders, initialEquipmentId, initialType }) => {
    // Hooks calculated values first
    const { uploadFiles, removeFile: deleteFile, isUploading } = useFileUpload();
    const { isAdmin, isTechnician, isObserver } = usePermissions(currentUser);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<WOPriority>(WOPriority.MEDIUM);
    const [type, setType] = useState<WOType>(initialType || WOType.CORRECTIVE);
    const [equipmentId, setEquipmentId] = useState(initialEquipmentId || '');
    const [section, setSection] = useState('');
    const [assignedUserId, setAssignedUserId] = useState(isTechnician ? currentUser.id : '');
    const [collaborators, setCollaborators] = useState<string[]>([]);
    const [collaboratingSections, setCollaboratingSections] = useState<string[]>([]);

    // Subtasks State
    const [subtasks, setSubtasks] = useState<SubTask[]>([]);
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('');

    // UI State
    const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
    const [isAddingCollaboratingSection, setIsAddingCollaboratingSection] = useState(false);
    const [showValidationErrors, setShowValidationErrors] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Attachments State
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [viewMedia, setViewMedia] = useState<{ type: 'image' | 'video' | 'pdf' | 'file'; url: string; name: string } | null>(null);

    // Auto-select section based on equipment
    useEffect(() => {
        if (equipmentId) {
            const eq = equipment.find(e => e.id === equipmentId);
            if (eq && eq.sections && eq.sections.length > 0) {
                setSection(eq.sections[0]);
            }
        }
    }, [equipmentId, equipment]);

    // Available sections based on user role
    const availableSections = useMemo(() => {
        if (isAdmin) {
            return sections.map(s => s.name);
        }
        return currentUser.sections;
    }, [currentUser, sections, isAdmin]);

    // Initialize section if only one available
    useEffect(() => {
        if (!section && availableSections.length === 1) {
            setSection(availableSections[0]);
        }
    }, [availableSections, section]);

    const handleCancel = async () => {
        // Cleanup orphaned files
        if (attachments.length > 0) {
            for (const att of attachments) {
                await deleteFile(att.url, 'work-order-files');
            }
        }
        onClose();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            try {
                const newAttachments = await uploadFiles(e.target.files, 'work-order-files', 'work-orders');
                setAttachments(prev => [...prev, ...newAttachments]);
            } catch (error) {
                // Error handled in hook (toast)
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const removeFile = async (id: string, url: string) => {
        await deleteFile(url, 'work-order-files');
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const handleAddSubtask = () => {
        if (!newTaskDesc.trim()) return;
        const newTask: SubTask = {
            id: Math.random().toString(36).substring(7),
            description: newTaskDesc,
            completed: false,
            assignedUserIds: newTaskAssignee ? [newTaskAssignee] : []
        };
        setSubtasks([...subtasks, newTask]);
        setNewTaskDesc('');
        setNewTaskAssignee('');
    };

    const removeSubtask = (id: string) => {
        setSubtasks(subtasks.filter(t => t.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowValidationErrors(true);

        if (!title.trim() || !equipmentId || !section) {
            toast.error('Por favor complete los campos obligatorios');
            return;
        }

        setIsSubmitting(true);

        const newWO: WorkOrder = {
            id: '', // Will be assigned by backend/service
            title,
            description,
            priority,
            status: WOStatus.PENDING,
            type,
            section,
            equipmentId,
            assignedUserId: assignedUserId || undefined,
            collaborators: collaborators.length > 0 ? collaborators : undefined,
            createdBy: currentUser.id,
            createdAt: new Date().toISOString(),
            attachments: attachments,
            usedParts: [],
            comments: [],
            statusHistory: [{ status: WOStatus.PENDING, timestamp: new Date().toISOString() }],
            subtasks: subtasks,
        };

        onClose();
        onSubmit(newWO);
        setIsSubmitting(false);
    };

    return (
        <>
            <Modal onClose={handleCancel}>
                <Modal.Header
                    onClose={handleCancel}
                    icon={<div className="p-2 bg-accent-dim rounded-lg text-accent"><FileText size={24} /></div>}
                >
                    Nueva Orden de Trabajo
                </Modal.Header>

                <Modal.Body>
                    <form id="create-wo-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Title - Full Width */}
                            <div className="col-span-1 md:col-span-2">
                                <FormInput
                                    label="Título *"
                                    placeholder="Ej. Ruido en motor principal"
                                    value={title}
                                    onChange={e => {
                                        setTitle(e.target.value);
                                        if (showValidationErrors && e.target.value.trim()) setShowValidationErrors(false);
                                    }}
                                    error={showValidationErrors && !title.trim()}
                                    helperText={showValidationErrors && !title.trim() ? "Este campo es obligatorio" : undefined}
                                />
                            </div>

                            {/* Description with Speech to Text */}
                            <div className="col-span-1 md:col-span-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label htmlFor="wo-description" className="block text-sm font-medium text-txt-2">Descripción (Opcional)</label>
                                    <VoiceInputButton
                                        onTranscript={(text) => setDescription(prev => prev ? prev + ' ' + text : text)}
                                    />
                                </div>
                                <FormTextarea
                                    placeholder="Detalla el problema encontrado... (puedes usar el micrófono para dictar)"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="h-32"
                                />
                            </div>

                            {/* Priority */}
                            <div>
                                <CustomSelect
                                    label="Prioridad *"
                                    value={priority}
                                    onChange={(val) => setPriority(val as WOPriority)}
                                    options={Object.values(WOPriority).map(p => ({ value: p, label: p }))}
                                />
                            </div>

                            {/* Type - Only for Admins/Managers */}
                            {!isTechnician && (
                                <div>
                                    <CustomSelect
                                        label="Tipo de OT *"
                                        value={type}
                                        onChange={(val) => setType(val as WOType)}
                                        options={Object.values(WOType).map(t => ({ value: t, label: t }))}
                                    />
                                </div>
                            )}

                            {/* Equipment */}
                            <div>
                                <label className="block text-sm font-medium text-txt-2 mb-1">Equipo / Activo *</label>
                                <EquipmentSelector
                                    equipment={equipment}
                                    selectedId={equipmentId}
                                    onSelect={(id) => {
                                        setEquipmentId(id);
                                        if (showValidationErrors && id) setShowValidationErrors(false);
                                    }}
                                    error={showValidationErrors && !equipmentId}
                                />
                                {showValidationErrors && !equipmentId && <p className="text-[10px] text-ko mt-1 font-medium">Debe seleccionar un equipo</p>}
                            </div>

                            {/* Section */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-txt-2">Sección Principal *</label>
                                </div>
                                <CustomSelect
                                    value={section}
                                    onChange={(val) => {
                                        setSection(val);
                                        if (showValidationErrors && val) setShowValidationErrors(false);
                                    }}
                                    options={availableSections.map(s => ({ value: s, label: s }))}
                                    placeholder="Seleccione sección"
                                    error={showValidationErrors && !section}
                                    disabled={isTechnician}
                                />
                                {showValidationErrors && !section && <p className="text-[10px] text-ko mt-1 font-medium">La sección es obligatoria</p>}
                            </div>

                            {/* Assigned To */}
                            <div>
                                <CustomSelect
                                    label="Responsable Principal"
                                    value={assignedUserId}
                                    onChange={(val) => setAssignedUserId(val)}
                                    options={[
                                        { value: "", label: "-- Sin Asignar --" },
                                        ...users
                                            .filter(u => {
                                                if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                                // Hide admins from non-admins
                                                if (u.role === UserRole.ADMIN && !isAdmin) return false;

                                                const allowedSections = [section, ...collaboratingSections];
                                                return u.sections.some(s => allowedSections.includes(s));
                                            })
                                            .map(u => ({ value: u.id, label: u.name }))
                                    ]}
                                    disabled={isTechnician}
                                />
                            </div>

                            {/* Collaborating Sections */}
                            <div>
                                <label className="block text-sm font-medium text-txt-2 mb-2 flex items-center gap-2">
                                    <Users size={16} /> Secciones Colaboradoras
                                </label>
                                <div className="flex flex-wrap gap-2 items-center min-h-[42px] p-2 bg-surface-2 border border-line rounded-lg">
                                    {collaboratingSections.map(sec => (
                                        <span key={sec} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-dim text-accent border border-accent-border transition-all hover:scale-105">
                                            {sec}
                                            <button
                                                type="button"
                                                onClick={() => setCollaboratingSections(prev => prev.filter(s => s !== sec))}
                                                className="hover:text-ko transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}

                                    <div className="relative">
                                        <button
                                            type="button"
                                            className={`p-1.5 rounded-full transition-all ${isAddingCollaboratingSection ? 'bg-accent text-white shadow-lg' : 'bg-surface text-accent border border-accent-border hover:bg-accent-dim '}`}
                                            onClick={() => setIsAddingCollaboratingSection(!isAddingCollaboratingSection)}
                                        >
                                            {isAddingCollaboratingSection ? <X size={16} /> : <Plus size={16} />}
                                        </button>

                                        {isAddingCollaboratingSection && (
                                            <div className="absolute left-0 top-full mt-2 w-56 bg-surface shadow-xl rounded-lg border border-line z-30 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                <div className="max-h-48 overflow-y-auto p-1">
                                                    {sections
                                                        .filter(s => s.name !== section && !collaboratingSections.includes(s.name))
                                                        .map(s => (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent-dim rounded-md transition-colors text-txt-2"
                                                                onClick={() => {
                                                                    setCollaboratingSections(prev => [...prev, s.name]);
                                                                    setIsAddingCollaboratingSection(false);
                                                                }}
                                                            >
                                                                {s.name}
                                                            </button>
                                                        ))}
                                                    {sections.filter(s => s.name !== section && !collaboratingSections.includes(s.name)).length === 0 && (
                                                        <div className="px-3 py-4 text-xs text-txt-3 italic text-center">
                                                            No hay más secciones disponibles
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Collaborators */}
                            <div>
                                <label className="block text-sm font-medium text-txt-2 mb-2 flex items-center gap-2">
                                    <UserPlus size={16} /> Colaboradores
                                </label>
                                <div className="flex flex-wrap gap-2 items-center min-h-[42px] p-2 bg-surface-2 border border-line rounded-lg">
                                    {collaborators.map(id => {
                                        const u = users.find(user => user.id === id);
                                        return u ? (
                                            <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-dim text-accent border border-accent-border transition-all hover:scale-105">
                                                {u.name.split(' ')[0]}
                                                <button
                                                    type="button"
                                                    onClick={() => setCollaborators(prev => prev.filter(c => c !== id))}
                                                    className="hover:text-ko transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        ) : null;
                                    })}

                                    <div className="relative">
                                        <button
                                            type="button"
                                            className={`p-1.5 rounded-full transition-all ${isAddingCollaborator ? 'bg-accent text-white shadow-lg' : 'bg-surface text-accent  border border-accent-border  hover:bg-accent-dim '}`}
                                            onClick={() => setIsAddingCollaborator(!isAddingCollaborator)}
                                            title="Añadir colaborador"
                                        >
                                            {isAddingCollaborator ? <X size={16} /> : <Plus size={16} />}
                                        </button>

                                        {isAddingCollaborator && (
                                            <div className="absolute left-0 top-full mt-2 w-64 bg-surface shadow-xl rounded-lg border border-line z-30 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                <div className="max-h-48 overflow-y-auto p-1">
                                                    {users
                                                        .filter(u => {
                                                            if (assignedUserId && u.id === assignedUserId) return false;
                                                            if (collaborators.includes(u.id)) return false;
                                                            if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                                            // Hide admins from non-admins
                                                            if (u.role === UserRole.ADMIN && !isAdmin) return false;

                                                            // Filter strictly by the sections involved in this WO
                                                            const allowedSections = [section, ...collaboratingSections];
                                                            return u.sections.some(s => allowedSections.includes(s));
                                                        })
                                                        .map(u => (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent-dim rounded-md transition-colors text-txt-2"
                                                                onClick={() => {
                                                                    setCollaborators(prev => [...prev, u.id]);
                                                                    setIsAddingCollaborator(false);
                                                                }}
                                                            >
                                                                <div className="font-medium">{u.name}</div>
                                                                <div className="text-[10px] text-txt-2 uppercase">{u.role}</div>
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Attachments Upload Section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-txt-2 flex items-center gap-2">
                                    <Paperclip size={16} /> Archivos Adjuntos
                                </label>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-3 py-1.5 btn btn-primary text-white rounded-lg transition-all text-xs font-medium active:scale-95 shadow-sm shadow-accent/20"
                                    disabled={isUploading}
                                >
                                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                    {isUploading ? 'Subiendo...' : 'Añadir archivo'}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    multiple
                                    className="hidden"
                                    onChange={handleFileChange}
                                    disabled={isUploading}
                                />
                            </div>

                            {/* Attachments List */}
                            {attachments.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {attachments.map((att) => {
                                        const isImg = att.type === 'image';
                                        return (
                                            <div
                                                key={att.id}
                                                className="relative group bg-surface-2 border border-line rounded-lg flex flex-col items-center overflow-hidden transition-colors cursor-pointer hover:border-accent"
                                                onClick={() => {
                                                    if (att.type === 'image') setViewMedia({ type: 'image', url: att.url, name: att.name });
                                                }}
                                            >
                                                <div className="w-full h-24 bg-surface-3 flex items-center justify-center overflow-hidden relative">
                                                    {isImg ? (
                                                        <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <FileText size={32} className="text-txt-3" />
                                                    )}
                                                </div>
                                                <div className="p-2 w-full">
                                                    <span className="block text-xs text-txt-2 font-medium truncate w-full text-center" title={att.name}>
                                                        {att.name}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(att.id, att.url)}
                                                    className="absolute top-1 right-1 p-1 bg-white rounded-full shadow text-ko hover:bg-ko-dim z-10"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="col-span-full py-6 text-center border-2 border-dashed border-line rounded-lg text-txt-3 text-sm bg-surface-2/50 bg-surface/20">
                                    <UploadCloud size={24} className="mx-auto mb-2 opacity-50" />
                                    No hay archivos adjuntos.
                                </div>
                            )}
                        </div>

                        {/* Subtasks Section */}
                        <div className="border-t border-line pt-6">
                            <label className="block text-sm font-bold text-txt-2 mb-3 flex items-center gap-2">
                                <ClipboardList size={18} /> Tareas Específicas
                            </label>

                            <div className="p-4 bg-surface-2 rounded-xl border border-line shadow-inner mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-7">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                id="create-wo-subtask-desc"
                                                name="subtaskDescription"
                                                className="w-full p-3 pr-24 text-sm border border-line rounded-xl bg-surface text-txt focus:ring-2 focus:ring-accent outline-none transition-shadow"
                                                placeholder="Descripción de la tarea..."
                                                value={newTaskDesc}
                                                onChange={e => setNewTaskDesc(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                                            />
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                <VoiceInputButton
                                                    onTranscript={(text) => setNewTaskDesc(prev => prev ? prev + ' ' + text : text)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <div>
                                            <CustomSelect
                                                value={newTaskAssignee}
                                                onChange={(val) => setNewTaskAssignee(val)}
                                                options={[
                                                    { value: "", label: "Sin asignar" },
                                                    ...users
                                                        .filter(u => {
                                                            if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                                            const allowedSections = [section, ...collaboratingSections];
                                                            return u.sections.some(s => allowedSections.includes(s));
                                                        })
                                                        .map(u => ({ value: u.id, label: u.name }))
                                                ]}
                                                placeholder="Sin asignar"
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <button
                                            type="button"
                                            onClick={handleAddSubtask}
                                            disabled={!newTaskDesc.trim()}
                                            className="w-full h-full p-2.5 btn btn-primary text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                                        >
                                            <Plus size={18} /> Añadir
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Subtask List */}
                            {subtasks.length > 0 && (
                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                    {subtasks.map((task, idx) => (
                                        <div key={task.id} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-line group hover:border-accent-border transition-colors shadow-sm">
                                            <div className="flex items-center gap-3 flex-1">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-txt-2">
                                                    {idx + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <p className="text-txt-2 text-sm font-medium">{task.description}</p>
                                                    <div className="flex flex-wrap gap-2 mt-1.5 font-mono">
                                                        {task.assignedUserIds?.map(userId => {
                                                            const user = users.find(u => u.id === userId);
                                                            if (!user) return null;
                                                            return (
                                                                <div key={user.id} className="flex items-center gap-1 text-[10px] uppercase font-bold bg-surface-2 px-1.5 py-0.5 rounded text-txt-2">
                                                                    <UserIcon size={10} />
                                                                    <span>{user.name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeSubtask(task.id)}
                                                className="p-2 text-txt-3 hover:text-ko hover:bg-ko-dim rounded-full transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </Modal.Body>

                <Modal.Footer>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 text-txt-2 hover:bg-surface-3 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-accent text-white rounded-lg hover:bg-accent-2 transition-colors shadow-lg shadow-accent/20"
                    >
                        Crear Orden
                    </button>
                </Modal.Footer>
            </Modal>

            {/* Media Viewer Lightbox */}
            {
                viewMedia && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                        <button onClick={() => setViewMedia(null)} className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                            <X size={32} />
                        </button>
                        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                            <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex items-center justify-center">
                                {viewMedia.type === 'image' ? (
                                    <img src={viewMedia.url} alt={viewMedia.name} className="w-full h-full object-contain shadow-2xl" />
                                ) : viewMedia.type === 'video' ? (
                                    <video src={viewMedia.url} controls autoPlay className="max-w-full max-h-full shadow-2xl" />
                                ) : (
                                    <div className="bg-surface p-8 rounded-2xl flex flex-col items-center gap-6">
                                        <FileText size={64} className="text-accent" />
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-txt mb-2">{viewMedia.name}</p>
                                            <p className="text-sm text-txt-2">Vista previa no disponible para este tipo de archivo.</p>
                                        </div>
                                        <a href={viewMedia.url} download={viewMedia.name} className="px-6 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent-2 transition-colors">
                                            Descargar Archivo
                                        </a>
                                    </div>
                                )}
                            </div>
                            <p className="text-white font-medium">{viewMedia.name}</p>
                        </div>
                    </div>
                )
            }
        </>
    );
};
