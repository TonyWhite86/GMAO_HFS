import React, { useState } from 'react';
import { CheckSquare, Plus, Check, X, User as UserIcon, Trash2 } from 'lucide-react';
import { WorkOrder, User, UserRole, SubTask } from '../../types';
import { useAppStore } from '../../store/useAppStore';

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

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare size={16} /> Tareas Específicas
                </label>
                {!isEditing && (
                    <div className="flex items-center gap-2 text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-400 rounded-lg border border-slate-700">
                        {editedWO.subtasks?.filter(t => t.completed).length || 0} / {editedWO.subtasks?.length || 0} Completadas
                    </div>
                )}
            </div>

            {/* New Task Form */}
            {isEditing && (
                <div className="mb-6 p-4 bg-slate-800/20 rounded-2xl border border-slate-800/60 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-[3]">
                            <input
                                type="text"
                                placeholder="Descripción de la tarea..."
                                className="w-full p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                            />
                        </div>
                        <div className="flex-[1.5]">
                            <select
                                className="w-full p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                                value={newTaskAssignee}
                                onChange={(e) => setNewTaskAssignee(e.target.value)}
                            >
                                <option value="">Sin asignar</option>
                                {users
                                    .filter(u => {
                                        if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                        const allowedSections = [editedWO.section, ...(editedWO.collaboratingSections || [])];
                                        return u.sections.some(s => allowedSections.includes(s));
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
                                className="px-6 h-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 whitespace-nowrap"
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
                        <div key={task.id} className={`p-4 rounded-xl border transition-all shadow-sm group ${task.completed ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/40 opacity-60' : 'bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500'}`}>
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
                                        ? 'bg-green-500 border-green-500 text-white shadow-md'
                                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent hover:border-blue-400'}`}
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
                                            className="w-full text-sm font-medium bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none pb-1 mb-2"
                                        />
                                    ) : (
                                        <p className={`text-sm font-medium ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {task.description}
                                        </p>
                                    )}

                                    {/* Assignments Pattern */}
                                    <div className="flex flex-wrap gap-2 items-center min-h-[32px] font-mono mt-1">
                                        {(task.assignedUserIds || []).map(uid => {
                                            const user = users.find(u => u.id === uid);
                                            return user ? (
                                                <div key={uid} className="flex items-center gap-1.5 text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600/50 text-slate-500 dark:text-slate-400">
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
                                                            className="ml-1 hover:text-red-500 transition-colors"
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
                                                    className={`p-1 rounded-full transition-all ${activeAssignTaskId === task.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                                                >
                                                    {activeAssignTaskId === task.id ? <X size={14} /> : <Plus size={14} />}
                                                </button>

                                                {activeAssignTaskId === task.id && (
                                                    <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-slate-700 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700 z-30 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                        <div className="max-h-48 overflow-y-auto p-1">
                                                            {users.filter(u => {
                                                                if ((task.assignedUserIds || []).includes(u.id)) return false;
                                                                if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                                                const allowedSections = [editedWO.section, ...(editedWO.collaboratingSections || [])];
                                                                return u.sections.some(s => allowedSections.includes(s));
                                                            }).map(u => (
                                                                <button
                                                                    key={u.id}
                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors text-slate-700 dark:text-slate-300 flex items-center gap-2"
                                                                    onClick={() => {
                                                                        const updated = editedWO.subtasks!.map(t =>
                                                                            t.id === task.id ? { ...t, assignedUserIds: [...(t.assignedUserIds || []), u.id] } : t
                                                                        );
                                                                        setEditedWO({ ...editedWO, subtasks: updated });
                                                                        setActiveAssignTaskId(null);
                                                                    }}
                                                                >
                                                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
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
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
                        No hay tareas definidas.
                    </div>
                )}
            </div>
        </div>
    );
};
