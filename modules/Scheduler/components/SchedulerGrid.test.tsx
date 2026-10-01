import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchedulerGrid } from './SchedulerGrid';
import { WorkOrder, User, UserRole, WOStatus, WOPriority, WOType } from '../../../types';

const baseWo = (over: Partial<WorkOrder> = {}): WorkOrder => ({
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
    scheduledDate: '2026-07-15T09:00:00',
    attachments: [],
    usedParts: [],
    comments: [],
    ...over,
});

const tech: User = { id: 'tech1', name: 'Ana García', email: '', role: UserRole.TECHNICIAN, sections: ['Planta'], active: true };

const days = [new Date(2026, 6, 15), new Date(2026, 6, 16)];

const renderGrid = (workOrders: WorkOrder[], technicians: User[] = [tech]) =>
    render(
        <SchedulerGrid
            viewMode="week"
            daysToShow={days}
            technicians={technicians}
            workOrders={workOrders}
            selectedSection=""
            onClearSection={vi.fn()}
            onDragStart={vi.fn()}
            onDragOver={vi.fn()}
            onDrop={vi.fn()}
            onUnassign={vi.fn()}
            onSelectWO={vi.fn()}
            onCreateAtSlot={vi.fn()}
        />
    );

describe('SchedulerGrid', () => {
    it('muestra el técnico y el número de tareas asignadas', () => {
        renderGrid([baseWo()]);
        expect(screen.getByText('Ana')).toBeTruthy();
        expect(screen.getByText('1 tareas')).toBeTruthy();
    });

    it('muestra la WO en su día programado', () => {
        renderGrid([baseWo()]);
        expect(screen.getByText('Cambio de rodamiento')).toBeTruthy();
    });

    it('no duplica la WO en otros días', () => {
        renderGrid([baseWo()]);
        expect(screen.getAllByText('Cambio de rodamiento')).toHaveLength(1);
    });

    it('no muestra las WOs asignadas a otros técnicos', () => {
        const woDeOtro = baseWo({ id: 'wo2', title: 'Lubricación bomba', assignedUserId: 'tech2' });
        renderGrid([baseWo(), woDeOtro]);
        expect(screen.getByText('Cambio de rodamiento')).toBeTruthy();
        expect(screen.queryByText('Lubricación bomba')).toBeNull();
    });

    it('muestra estado vacío cuando no hay técnicos', () => {
        renderGrid([], []);
        expect(screen.getByText(/No hay técnicos asignados a la sección/)).toBeTruthy();
    });
});
