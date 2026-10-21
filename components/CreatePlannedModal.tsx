
import React, { useState } from 'react';
import { Plus, Trash2, Calendar, ClipboardList, User as UserIcon, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { CustomSelect } from './ui/CustomSelect';
import { WorkOrder, WOType, WOStatus, WOPriority, User, Equipment, SubTask, UserRole, Section } from '../types';
import { useAppStore } from '../store/useAppStore';
import { canBeAssignedToWO } from '../utils/incidentVisibility';
import { EquipmentSelector } from './EquipmentSelector';
import { Modal } from './ui/Modal';
import { FormInput } from './ui/FormInput';
import { FormTextarea } from './ui/FormTextarea';
import { VoiceInputButton } from './ui/VoiceInputButton';

interface CreatePlannedModalProps {
    onClose: () => void;
    onSubmit: (wo: WorkOrder) => void;
    equipment: Equipment[];
    users: User[];
    currentUser: User;
    sections: Section[];
    existingWorkOrders: WorkOrder[];
}

export const CreatePlannedModal: React.FC<CreatePlannedModalProps> = ({
    onClose, onSubmit, equipment, users, currentUser, sections, existingWorkOrders
}) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [equipmentId, setEquipmentId] = useState(equipment[0]?.id || '');
    const [scheduledDate, setScheduledDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 16)); // Tomorrow default
    const [section, setSection] = useState(currentUser.sections[0] || (sections.length > 0 ? sections[0].name : 'Producción'));
    // Responsable interno: siempre disponible, aunque la ejecución sea externa.
    const [assignedUserId, setAssignedUserId] = useState('');
    // Ejecución externa: la realiza una contrata, pero el caso sigue teniendo
    // responsable interno y sección propietaria.
    const [isExternal, setIsExternal] = useState(false);
    const [contractorId, setContractorId] = useState('');
    const [externalPrice, setExternalPrice] = useState('');
    const contractors = useAppStore(s => s.contractors);

    // Subtaks State
    const [subtasks, setSubtasks] = useState<SubTask[]>([]);
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('');

    const handleAddSubtask = () => {
        if (!newTaskDesc.trim()) return;

        const newTask: SubTask = {
            id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            description: newTaskDesc.trim(),
            assignedUserIds: newTaskAssignee ? [newTaskAssignee] : [],
            completed: false
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
        if (!title.trim() || !equipmentId) return;
        if (!isExternal && subtasks.length === 0) return;
        if (isExternal && !contractorId) {
            toast.error('Una actuación externa necesita una contrata');
            return;
        }

        const newWO: WorkOrder = {
            id: '',
            title,
            description: description || 'Actuación Programada con múltiples tareas.',
            type: WOType.PLANNED,
            status: WOStatus.SCHEDULED,
            priority: WOPriority.MEDIUM, // Default priority
            equipmentId,
            section,
            createdBy: currentUser.id,
            assignedUserId: assignedUserId || undefined,
            isExternal,
            contractorId: isExternal ? contractorId : undefined,
            externalPrice: isExternal && externalPrice ? Number(externalPrice) : undefined,
            createdAt: new Date().toISOString(),
            scheduledDate: new Date(scheduledDate).toISOString(),
            attachments: [],
            usedParts: [],
            comments: [],
            subtasks: subtasks
        };

        onSubmit(newWO);
    };

    // Asignables: mismo criterio que assign_work_order en BD (helper compartido).
    const filteredUsers = users.filter(u => canBeAssignedToWO(u, section, [], sections));

    return (
        <Modal onClose={onClose}>
            <Modal.Header onClose={onClose}>
                <div className="flex items-center gap-3">
                    <span>Nueva Actuación Programada</span>
                    <span className="bdg bdg-accent !text-[10px] !uppercase !tracking-wider">Planificado</span>
                </div>
            </Modal.Header>

            <Modal.Body>
                <form id="create-planned-form" onSubmit={handleSubmit} className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Title */}
                        <div className="md:col-span-2">
                            <FormInput
                                label="Título *"
                                placeholder="Ej. Instalación de nueva línea de envasado"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-txt-2">Descripción</label>
                                <VoiceInputButton
                                    onTranscript={(text) => setDescription(prev => prev ? prev + ' ' + text : text)}
                                />
                            </div>
                            <FormTextarea
                                placeholder="Detalles de la actuación..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="h-20"
                            />
                        </div>

                        {/* Equipment */}
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Equipo / Activo *</label>
                            <EquipmentSelector
                                equipment={equipment}
                                selectedId={equipmentId}
                                onSelect={setEquipmentId}
                                required
                                color="orange"
                            />
                        </div>

                        {/* Scheduled Date */}
                        <div>
                            <FormInput
                                label="Fecha Programada *"
                                type="datetime-local"
                                value={scheduledDate}
                                onChange={e => setScheduledDate(e.target.value)}
                                required
                            />
                        </div>

                        {/* Section */}
                        <div>
                            <CustomSelect
                                label="Sección *"
                                value={section}
                                onChange={(val) => setSection(val)}
                                options={sections.map(s => ({ value: s.name, label: s.name }))}
                                disabled={currentUser.role !== UserRole.ADMIN}
                            />
                        </div>

                        {/* Assigned To */}
                        <div>
                            <CustomSelect
                                label="Responsable interno (sigue el caso)"
                                value={assignedUserId}
                                onChange={(val) => setAssignedUserId(val)}
                                options={[
                                    { value: "", label: "Sin Asignar" },
                                    ...filteredUsers.map(u => ({ value: u.id, label: u.name }))
                                ]}
                            />
                            {filteredUsers.length === 0 && (
                                <p className="text-[11px] text-txt-3 mt-1">
                                    No hay usuarios de esta sección. Puedes dejarlo sin asignar y asignarlo luego.
                                </p>
                            )}
                        </div>

                        {/* Trabajo externo */}
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-txt-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={isExternal}
                                    onChange={(e) => setIsExternal(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <Building2 size={14} /> Lo ejecuta una contrata (trabajo externo)
                            </label>
                            <p className="text-[11px] text-txt-3 mt-1">
                                El responsable interno y la sección siguen siendo los que hacen seguimiento del caso.
                            </p>
                            {isExternal && (
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-line bg-surface-2">
                                    <CustomSelect
                                        label="Contrata"
                                        value={contractorId}
                                        onChange={setContractorId}
                                        options={contractors
                                            .filter(c => c.active)
                                            .map(c => ({ value: c.id, label: c.name }))}
                                        placeholder="Selecciona la contrata…"
                                    />
                                    <div>
                                        <label className="block text-sm font-medium text-txt-2 mb-2">Precio (€)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={externalPrice}
                                            onChange={(e) => setExternalPrice(e.target.value)}
                                            placeholder="0.00"
                                            className="fld-input w-full p-3 rounded-[6px] outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bulk Assignment UI (Conditional) */}
                    {assignedUserId && subtasks.length > 0 && (
                        <div className="bg-surface-2 p-4 rounded-lg border border-line animate-fade-in">
                            <h4 className="text-sm font-semibold text-txt mb-2 flex items-center gap-2">
                                <UserIcon size={14} />
                                Asignar tareas a {users.find(u => u.id === assignedUserId)?.name}
                            </h4>
                            <div className="space-y-2">
                                {subtasks.map((task, idx) => {
                                    const isAssigned = task.assignedUserIds?.includes(assignedUserId);
                                    return (
                                        <label key={task.id} className="flex items-center gap-2 text-sm text-txt-2 cursor-pointer hover:bg-surface-2 p-1.5 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                className="rounded border-line-2 text-warn focus:ring-warn"
                                                checked={!!isAssigned}
                                                onChange={() => {
                                                    const newSubtasks = subtasks.map(t => {
                                                        if (t.id === task.id) {
                                                            const currentIds = t.assignedUserIds || [];
                                                            const newIds = isAssigned
                                                                ? currentIds.filter(id => id !== assignedUserId)
                                                                : [...currentIds, assignedUserId];
                                                            return { ...t, assignedUserIds: newIds };
                                                        }
                                                        return t;
                                                    });
                                                    setSubtasks(newSubtasks);
                                                }}
                                            />
                                            <span className="truncate flex-1">{idx + 1}. {task.description}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Subtasks Section */}
                    <div className="border-t border-line pt-4">
                        <label className="block text-sm font-medium text-txt-2 mb-3 flex items-center gap-2">
                            <ClipboardList size={18} /> Tareas y Asignaciones
                        </label>

                        <div className="flex flex-col md:flex-row gap-2 mb-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Descripción de la tarea..."
                                        value={newTaskDesc}
                                        onChange={e => setNewTaskDesc(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                                        className="w-full p-3 pr-24 border border-line rounded-xl bg-surface text-txt focus:ring-2 focus:ring-warn outline-none transition-shadow"
                                    />
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                        <VoiceInputButton
                                            onTranscript={(text) => setNewTaskDesc(prev => prev ? prev + ' ' + text : text)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="w-full md:w-48">
                                <CustomSelect
                                    value={newTaskAssignee}
                                    onChange={(val) => setNewTaskAssignee(val)}
                                    options={[
                                        { value: "", label: "Sin asignar" },
                                        ...filteredUsers.map(u => ({ value: u.id, label: u.name }))
                                    ]}
                                    placeholder="Sin asignar"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAddSubtask}
                                disabled={!newTaskDesc.trim()}
                                className="btn btn-ghost"
                            >
                                <Plus size={18} /> Añadir
                            </button>
                        </div>

                        {/* Task List */}
                        {subtasks.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {subtasks.map((task, idx) => {
                                    // Handle array of IDs
                                    const firstUserId = task.assignedUserIds?.[0];
                                    const assignedUser = firstUserId ? users.find(u => u.id === firstUserId) : null;

                                    return (
                                        <div key={task.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-line group">
                                            <div className="flex-1">
                                                <p className="text-txt-2 text-sm font-medium">{idx + 1}. {task.description}</p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {task.assignedUserIds?.map(userId => {
                                                        const user = users.find(u => u.id === userId);
                                                        if (!user) return null;
                                                        return (
                                                            <div key={user.id} className="flex items-center gap-1 text-xs bg-surface-3 px-1.5 py-0.5 rounded text-txt-2">
                                                                <UserIcon size={10} />
                                                                <span>{user.name}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeSubtask(task.id)}
                                                className="p-1.5 text-txt-3 hover:text-ko hover:bg-ko-dim rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-txt-3 text-sm italic border-2 border-dashed border-line rounded-lg">
                                {isExternal
                                    ? 'Sin tareas. En actuaciones externas son opcionales (el trabajo lo hace la contrata).'
                                    : 'No hay tareas añadidas. Añade al menos una tarea para crear la actuación.'}
                            </div>
                        )}
                    </div>
                </form>
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="btn btn-ghost"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={
                        !title.trim() || !equipmentId
                        || (!isExternal && subtasks.length === 0)
                        || (isExternal && !contractorId)
                    }
                    className="btn btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Calendar size={18} /> Crear Actuación
                </button>
            </Modal.Footer>
        </Modal>
    );
};
