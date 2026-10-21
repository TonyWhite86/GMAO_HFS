import React, { useState } from 'react';
import { CheckSquare, Plus, Check, X, User as UserIcon, Trash2 } from 'lucide-react';
import { WorkOrder, User, UserRole, SubTask, Section } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { canBeAssignedToWO } from '../../utils/incidentVisibility';

interface WOSubtasksListProps {
    editedWO: WorkOrder;
    setEditedWO: (wo: WorkOrder) => void;
    isEditing: boolean;
    users: User[];
}

export const WOSubtasksList: React.FC<WOSubtasksListProps> = ({
    editedWO,
    setEditedWO,
    isEditing,
    users
}) => {
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('');
    const [activeAssignTaskId, setActiveAssignTaskId] = useState<string | null>(null);
    // Catálogo de secciones (para detectar comodines al asignar)
    const catalogSections = useAppStore(s => s.sections) as Section[];

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <label className="block text-xs font-bold text-txt-2 uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare size={16} /> Tareas Específicas
                </label>
                {!isEditing && (
                    <div className="flex items-center gap-2 text-[10px] font-bold px-2 py-1 bg-surface-3 text-txt-3 rounded-lg border border-line">
                        {editedWO.subtasks?.filter(t => t.completed).length || 0} / {editedWO.subtasks?.length || 0} Completadas
                    </div>
                )}
            </div>

            {/* New Task Form */}
            {isEditing && (
                <div className="mb-6 p-4 bg-surface-2 rounded-2xl border border-line/60 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-[3]">
                            <input
                                type="text"
                                placeholder="Descripción de la tarea..."
                                className="w-full p-3 bg-surface-3 border border-line rounded-xl text-white outline-none focus:ring-2 focus:ring-accent text-sm transition-all"
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                            />
                        </div>
                        <div className="flex-[1.5]">
                            <select
                                className="w-full p-3 bg-surface-3 border border-line rounded-xl text-white outline-none focus:ring-2 focus:ring-accent text-sm transition-all"
                                value={newTaskAssignee}
                                onChange={(e) => setNewTaskAssignee(e.target.value)}
                            >
                                <option value="">Sin asignar</option>
                                {users
                                    .filter(u => {
                                        if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                        return canBeAssignedToWO(u, editedWO.section, editedWO.collaboratingSections || [], catalogSections);
                                    })
                                    .map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                            </select>
                        </div>
                        <div className="flex-none">
                            <button
                                type="button"
                                onClick={() => {
                                    const newTask: SubTask = {
                                        id: crypto.randomUUID(),
                                        description: newTaskDesc,
                                        completed: false,
                                        assignedUserIds: newTaskAssignee ? [newTaskAssignee] : []
                                    };
                                    setEditedWO({ ...editedWO, subtasks: [...(editedWO.subtasks || []), newTask] });
                                    setNewTaskDesc('');
                                    setNewTaskAssignee('');
                                }}
                                disabled={!newTaskDesc.trim()}
                                className="px-6 h-full p-3 btn btn-primary text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-accent/20 whitespace-nowrap"
                            >
                                <Plus size={18} /> Añadir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Subtask List */}
            <div className="space-y-3">
                {(editedWO.subtasks && editedWO.subtasks.length > 0) ? (
                    editedWO.subtasks.map((task) => (
                        <div key={task.id} className={`p-4 rounded-xl border transition-all shadow-sm group ${task.completed ? 'bg-ok-dim border-ok-border opacity-60' : 'bg-surface border-line hover:border-accent-border'}`}>
                            <div className="flex items-start gap-4">
                                {/* Checkbox */}
                                <button
                                    onClick={async () => {
                                        const newCompleted = !task.completed;
                                        if (isEditing) {
                                            const updated = editedWO.subtasks!.map(t =>
                                                t.id === task.id ? { ...t, completed: newCompleted } : t
                                            );
                                            setEditedWO({ ...editedWO, subtasks: updated });
                                        } else {
                                            // Persist immediately in view mode
                                            try {
                                                await useAppStore.getState().toggleSubtask(task.id, newCompleted);
                                            } catch (err) {
                                                console.error('Error toggling subtask:', err);
                                            }
                                        }
                                    }}
                                    className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed
                                        ? 'bg-ok border-ok text-white shadow-md'
                                        : 'bg-surface border-line text-transparent hover:border-accent'}`}
                                >
                                    <Check size={16} strokeWidth={3} />
                                </button>

                                <div className="flex-1">
                                    {/* Description */}
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={task.description}
                                            onChange={(e) => {
                                                const updated = editedWO.subtasks!.map(t =>
                                                    t.id === task.id ? { ...t, description: e.target.value } : t
                                                );
                                                setEditedWO({ ...editedWO, subtasks: updated });
                                            }}
                                            className="w-full text-sm font-medium bg-transparent border-b border-dashed border-line-2 focus:border-accent outline-none pb-1 mb-2"
                                        />
                                    ) : (
                                        <p className={`text-sm font-medium ${task.completed ? 'text-txt-2 line-through' : 'text-txt-2'}`}>
                                            {task.description}
                                        </p>
                                    )}

                                    {/* Assignments Pattern */}
                                    <div className="flex flex-wrap gap-2 items-center min-h-[32px] font-mono mt-1">
                                        {(task.assignedUserIds || []).map(uid => {
                                            const user = users.find(u => u.id === uid);
                                            return user ? (
                                                <div key={uid} className="flex items-center gap-1.5 text-[10px] uppercase font-bold bg-surface-2 px-2 py-1 rounded-full border border-line/50 text-txt-2">
                                                    <UserIcon size={10} />
                                                    <span>{user.name.split(' ')[0]}</span>
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => {
                                                                const updated = editedWO.subtasks!.map(t =>
                                                                    t.id === task.id ? { ...t, assignedUserIds: t.assignedUserIds?.filter(id => id !== uid) } : t
                                                                );
                                                                setEditedWO({ ...editedWO, subtasks: updated });
                                                            }}
                                                            className="ml-1 hover:text-ko transition-colors"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : null;
                                        })}

                                        {isEditing && (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setActiveAssignTaskId(activeAssignTaskId === task.id ? null : task.id)}
                                                    className={`p-1 rounded-full transition-all ${activeAssignTaskId === task.id ? 'bg-accent text-white' : 'bg-surface-2 border border-line text-accent hover:bg-accent-dim '}`}
                                                >
                                                    {activeAssignTaskId === task.id ? <X size={14} /> : <Plus size={14} />}
                                                </button>

                                                {activeAssignTaskId === task.id && (
                                                    <div className="absolute left-0 top-full mt-2 w-56 bg-surface shadow-xl rounded-lg border border-line z-30 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                        <div className="max-h-48 overflow-y-auto p-1">
                                                            {users.filter(u => {
                                                                if ((task.assignedUserIds || []).includes(u.id)) return false;
                                                                if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                                                return canBeAssignedToWO(u, editedWO.section, editedWO.collaboratingSections || [], catalogSections);
                                                            }).map(u => (
                                                                <button
                                                                    key={u.id}
                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-accent-dim rounded-md transition-colors text-txt-2 flex items-center gap-2"
                                                                    onClick={() => {
                                                                        const updated = editedWO.subtasks!.map(t =>
                                                                            t.id === task.id ? { ...t, assignedUserIds: [...(t.assignedUserIds || []), u.id] } : t
                                                                        );
                                                                        setEditedWO({ ...editedWO, subtasks: updated });
                                                                        setActiveAssignTaskId(null);
                                                                    }}
                                                                >
                                                                    <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-bold">
                                                                        {u.name.charAt(0)}
                                                                    </div>
                                                                    {u.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditedWO({ ...editedWO, subtasks: editedWO.subtasks!.filter(t => t.id !== task.id) });
                                        }}
                                        className="p-2 text-txt-3 hover:text-ko hover:bg-ko-dim rounded-full transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 rounded-2xl border-2 border-dashed border-line text-txt-3 text-sm">
                        No hay tareas definidas.
                    </div>
                )}
            </div>
        </div>
    );
};
