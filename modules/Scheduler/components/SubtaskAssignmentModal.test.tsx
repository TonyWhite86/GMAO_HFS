import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubtaskAssignmentModal } from './SubtaskAssignmentModal';
import { WorkOrder, User, UserRole, WOStatus, WOPriority, WOType, SubTask } from '../../../types';

const subtasks: SubTask[] = [
    { id: 's1', description: 'Fijar bridas', completed: false, assignedUserIds: [] },
    { id: 's2', description: 'Comprobar fugas', completed: false, assignedUserIds: ['tech1'] },
];

const wo: WorkOrder = {
    id: 'wo1',
    title: 'Cambio de rodamiento',
    description: '',
    type: WOType.CORRECTIVE,
    status: WOStatus.SCHEDULED,
    priority: WOPriority.HIGH,
    equipmentId: 'eq1',
    assignedUserId: 'tech1',
    collaborators: [],
    section: 'Planta',
    createdBy: 'u-admin',
    createdAt: '2026-07-15T09:00:00',
    attachments: [],
    usedParts: [],
    comments: [],
    subtasks,
};

const users: User[] = [
    { id: 'tech1', name: 'Ana García', email: '', role: UserRole.TECHNICIAN, sections: ['Planta'], active: true },
    { id: 'tech2', name: 'Luis Pérez', email: '', role: UserRole.TECHNICIAN, sections: ['Planta'], active: true },
];

const props = {
    pendingAssignment: { wo, userId: 'tech2', date: new Date(2026, 6, 15) },
    users,
    assignMain: true,
    selectedSubtasks: ['s1'],
    onAssignMainChange: vi.fn(),
    onToggleSubtask: vi.fn(),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
};

describe('SubtaskAssignmentModal', () => {
    it('muestra el técnico asignado y todas las subtareas', () => {
        render(<SubtaskAssignmentModal {...props} />);
        expect(screen.getByText('Luis Pérez')).toBeTruthy();
        expect(screen.getByText('1. Fijar bridas')).toBeTruthy();
        expect(screen.getByText('2. Comprobar fugas')).toBeTruthy();
    });

    it('muestra los nombres ya asignados en cada subtarea', () => {
        render(<SubtaskAssignmentModal {...props} />);
        expect(screen.getByText('Ana García')).toBeTruthy();
    });

    it('marca las subtareas según selectedSubtasks', () => {
        render(<SubtaskAssignmentModal {...props} />);
        const s1 = screen.getByLabelText(/Fijar bridas/) as HTMLInputElement;
        const s2 = screen.getByLabelText(/Comprobar fugas/) as HTMLInputElement;
        expect(s1.checked).toBe(true);
        expect(s2.checked).toBe(false);
    });

    it('dispara onToggleSubtask al marcar una subtarea', () => {
        render(<SubtaskAssignmentModal {...props} />);
        fireEvent.click(screen.getByLabelText(/Comprobar fugas/));
        expect(props.onToggleSubtask).toHaveBeenCalledWith('s2');
    });

    it('dispara onAssignMainChange con el nuevo valor', () => {
        render(<SubtaskAssignmentModal {...props} />);
        fireEvent.click(screen.getByLabelText('Asignar como Responsable Principal'));
        expect(props.onAssignMainChange).toHaveBeenCalledWith(false);
    });

    it('dispara onConfirm y onClose', () => {
        render(<SubtaskAssignmentModal {...props} />);
        fireEvent.click(screen.getByText('Confirmar Asignación'));
        expect(props.onConfirm).toHaveBeenCalled();
        fireEvent.click(screen.getByText('Cancelar'));
        expect(props.onClose).toHaveBeenCalled();
    });
});
