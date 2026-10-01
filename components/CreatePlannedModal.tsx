
import React, { useState } from 'react';
import { Plus, Trash2, Calendar, ClipboardList, User as UserIcon } from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect';
import { WorkOrder, WOType, WOStatus, WOPriority, User, Equipment, SubTask, UserRole, Section } from '../types';
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
    const [assignedUserId, setAssignedUserId] = useState('');

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
        if (!title.trim() || !equipmentId || subtasks.length === 0) return;

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
            createdAt: new Date().toISOString(),
            scheduledDate: new Date(scheduledDate).toISOString(),
            attachments: [],
            usedParts: [],
            comments: [],
            subtasks: subtasks
        };

        onSubmit(newWO);
    };

    // Filtered users for assignment (Same logic as other modals)
    const filteredUsers = users.filter(u => {
        if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;

        // New Restriction: Only show users if they belong to the selected section
        if (!u.sections.includes(section)) return false;

        // Admins see everyone (within that section)
        if (currentUser.role === UserRole.ADMIN) return true;

        // Techs/Managers only see own section
        return true;
    });

    return (
        <Modal onClose={onClose}>
            <Modal.Header onClose={onClose}>
                <div className="flex items-center gap-3">
                    <span>Nueva Actuación Programada</span>
                    <span className="text-sm px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg font-bold uppercase tracking-wider text-[10px]">Planificado</span>
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
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Descripción</label>
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
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Equipo / Activo *</label>
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
                                label="Asignado a"
                                value={assignedUserId}
                                onChange={(val) => setAssignedUserId(val)}
                                options={[
                                    { value: "", label: "Sin Asignar" },
                                    ...filteredUsers.map(u => ({ value: u.id, label: u.name }))
                                ]}
                            />
                        </div>
                    </div>

                    {/* Bulk Assignment UI (Conditional) */}
                    {assignedUserId && subtasks.length > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/20 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                                <UserIcon size={14} />
                                Asignar tareas a {users.find(u => u.id === assignedUserId)?.name}
                            </h4>
                            <div className="space-y-2">
                                {subtasks.map((task, idx) => {
                                    const isAssigned = task.assignedUserIds?.includes(assignedUserId);
                                    return (
                                        <label key={task.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-white dark:hover:bg-slate-800 p-1.5 rounded transition-colors">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
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
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
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
                                        className="w-full p-3 pr-24 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
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
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
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
                                        <div key={task.id} className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 group">
                                            <div className="flex-1">
                                                <p className="text-slate-800 dark:text-slate-200 text-sm font-medium">{idx + 1}. {task.description}</p>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {task.assignedUserIds?.map(userId => {
                                                        const user = users.find(u => u.id === userId);
                                                        if (!user) return null;
                                                        return (
                                                            <div key={user.id} className="flex items-center gap-1 text-xs bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-200">
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
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm italic border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                No hay tareas añadidas. Añade al menos una tarea para crear la actuación.
                            </div>
                        )}
                    </div>
                </form>
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                    Cancelar
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={subtasks.length === 0 || !title.trim() || !equipmentId}
                    className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg shadow-orange-500/20 disabled:shadow-none transition-all flex items-center gap-2"
                >
                    <Calendar size={18} /> Crear Actuación
                </button>
            </Modal.Footer>
        </Modal>
    );
};
