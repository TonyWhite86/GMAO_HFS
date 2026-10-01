import React from 'react';
import { WorkOrder, User } from '../../../types';
import { Modal } from '../../../components/ui/Modal';

interface SubtaskAssignmentModalProps {
    pendingAssignment: { wo: WorkOrder, userId: string, date: Date };
    users: User[];
    assignMain: boolean;
    onAssignMainChange: (value: boolean) => void;
    selectedSubtasks: string[];
    onToggleSubtask: (id: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}

export const SubtaskAssignmentModal: React.FC<SubtaskAssignmentModalProps> = ({
    pendingAssignment,
    users,
    assignMain,
    onAssignMainChange,
    selectedSubtasks,
    onToggleSubtask,
    onClose,
    onConfirm
}) => {
    return (
        <Modal onClose={onClose} size="md">
            <Modal.Header onClose={onClose}>Asignar Tareas</Modal.Header>

            <Modal.Body>
                <div className="mb-4">
                    <p className="text-sm text-slate-500 mb-2">Asignando a: <span className="font-bold text-slate-800 dark:text-gray-200">{users.find(u => u.id === pendingAssignment.userId)?.name}</span></p>
                    <label className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30 cursor-pointer">
                        <input
                            type="checkbox"
                            id="assign-main-checkbox"
                            name="assignMain"
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            checked={assignMain}
                            onChange={(e) => onAssignMainChange(e.target.checked)}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">Asignar como Responsable Principal</span>
                    </label>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Selecciona las tareas a asignar:</label>
                    {pendingAssignment.wo.subtasks?.map((task, idx) => (
                        <label key={task.id} className="flex items-start gap-3 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input
                                type="checkbox"
                                id={`subtask-assign-${task.id}`}
                                name={`subtaskAssign-${task.id}`}
                                className="mt-1 rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                                checked={selectedSubtasks.includes(task.id)}
                                onChange={() => onToggleSubtask(task.id)}
                            />
                            <div className="flex-1">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">{idx + 1}. {task.description}</span>
                                {task.assignedUserIds && task.assignedUserIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {task.assignedUserIds.map(uid => (
                                            <span key={uid} className="text-[10px] px-1 bg-slate-200 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300">
                                                {users.find(u => u.id === uid)?.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                    Cancelar
                </button>
                <button
                    onClick={onConfirm}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors"
                >
                    Confirmar Asignación
                </button>
            </Modal.Footer>
        </Modal>
    );
};
