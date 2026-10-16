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
    onSelectAll: (ids: string[]) => void;
    onClearSelection: () => void;
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
    onSelectAll,
    onClearSelection,
    onClose,
    onConfirm
}) => {
    const { wo, userId } = pendingAssignment;
    // Las que ya están asignadas a este usuario no se pueden volver a asignar:
    // se excluyen del "todas" para no rellenar la selección de ruido.
    const assignable = (wo.subtasks || []).filter(t => !(t.assignedUserIds || []).includes(userId));
    const allSelected = assignable.length > 0 && assignable.every(t => selectedSubtasks.includes(t.id));
    const someSelected = selectedSubtasks.length > 0 && !allSelected;

    const handleMasterToggle = () => {
        if (allSelected) onClearSelection();
        else onSelectAll(assignable.map(t => t.id));
    };

    return (
        <Modal onClose={onClose} size="md">
            <Modal.Header onClose={onClose}>Asignar Tareas</Modal.Header>

            <Modal.Body>
                <div className="mb-4">
                    <p className="text-sm text-txt-2 mb-2">Asignando a: <span className="font-bold text-txt">{users.find(u => u.id === pendingAssignment.userId)?.name}</span></p>
                    <label className="flex items-center gap-2 p-3 bg-accent-dim rounded-lg border border-accent-border cursor-pointer">
                        <input
                            type="checkbox"
                            id="assign-main-checkbox"
                            name="assignMain"
                            className="rounded text-accent focus:ring-accent w-4 h-4"
                            checked={assignMain}
                            onChange={(e) => onAssignMainChange(e.target.checked)}
                        />
                        <span className="font-medium text-txt-2">Asignar como Responsable Principal</span>
                    </label>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="block text-sm font-medium text-txt-2">Selecciona las tareas a asignar:</label>
                        <label className="flex items-center gap-2 text-xs font-bold text-txt-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                id="subtask-assign-all"
                                name="subtaskAssignAll"
                                className="rounded text-warn focus:ring-warn w-4 h-4"
                                checked={allSelected}
                                ref={el => { if (el) el.indeterminate = someSelected; }}
                                onChange={handleMasterToggle}
                                disabled={assignable.length === 0}
                            />
                            Todas ({assignable.length})
                        </label>
                    </div>

                    {(wo.subtasks || []).map((task, idx) => {
                        const alreadyAssigned = (task.assignedUserIds || []).includes(userId);
                        return (
                            <label key={task.id} className={`flex items-start gap-3 p-3 bg-surface-2 rounded-lg border border-line transition-colors ${alreadyAssigned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-2 '}`}>
                                <input
                                    type="checkbox"
                                    id={`subtask-assign-${task.id}`}
                                    name={`subtaskAssign-${task.id}`}
                                    className="mt-1 rounded text-warn focus:ring-warn w-4 h-4"
                                    checked={selectedSubtasks.includes(task.id)}
                                    disabled={alreadyAssigned}
                                    onChange={() => onToggleSubtask(task.id)}
                                />
                                <div className="flex-1">
                                    <span className="text-sm font-medium text-txt-2 block">
                                        {idx + 1}. {task.description}
                                        {alreadyAssigned && <span className="ml-2 text-[10px] uppercase font-bold text-warn">ya asignada</span>}
                                    </span>
                                    {task.assignedUserIds && task.assignedUserIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {task.assignedUserIds.map(uid => (
                                                <span key={uid} className="text-[10px] px-1 bg-surface-3 rounded text-txt-2">
                                                    {users.find(u => u.id === uid)?.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </label>
                        );
                    })}
                </div>
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-txt-2 hover:bg-surface-2 rounded-lg transition-colors font-medium"
                >
                    Cancelar
                </button>
                <button
                    onClick={onConfirm}
                    className="px-6 py-2 btn btn-primary text-white rounded-lg font-medium shadow-sm transition-colors"
                >
                    Confirmar Asignación
                </button>
            </Modal.Footer>
        </Modal>
    );
};
