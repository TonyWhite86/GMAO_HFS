import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnassignedSidebar } from './UnassignedSidebar';
import { WorkOrder, User, UserRole, WOStatus, WOPriority, WOType } from '../../../types';

const wo: WorkOrder = {
    id: 'wo1',
    title: 'Cambio de rodamiento',
    description: '',
    type: WOType.CORRECTIVE,
    status: WOStatus.PENDING,
    priority: WOPriority.HIGH,
    equipmentId: 'eq1',
    section: 'Planta',
    createdBy: 'u-admin',
    createdAt: '2026-07-15T09:00:00',
    attachments: [],
    usedParts: [],
    comments: [],
};

const techPlanta: User = { id: 'tech1', name: 'Ana García', email: '', role: UserRole.TECHNICIAN, sections: ['Planta'], active: true };
const techAlmacen: User = { id: 'tech2', name: 'Luis Pérez', email: '', role: UserRole.TECHNICIAN, sections: ['Almacén'], active: true };

const baseProps = () => ({
    unassignedWOs: [wo],
    technicians: [techPlanta, techAlmacen],
    searchTerm: '',
    onSearchChange: vi.fn(),
    onDragStart: vi.fn(),
    onSelectWO: vi.fn(),
    onAssign: vi.fn(),
});

describe('UnassignedSidebar', () => {
    it('muestra las órdenes sin asignar con su estado', () => {
        render(<UnassignedSidebar {...baseProps()} />);
        expect(screen.getByText('Sin asignar')).toBeTruthy();
        expect(screen.getByText('Cambio de rodamiento')).toBeTruthy();
        expect(screen.getByText('Pendiente')).toBeTruthy();
    });

    it('solo ofrece técnicos de la sección de la WO en la asignación rápida', () => {
        render(<UnassignedSidebar {...baseProps()} />);
        const select = screen.getByLabelText('Asignar tarea Cambio de rodamiento');
        const options = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
        expect(options).toContain('Ana García');
        expect(options).not.toContain('Luis Pérez');
    });

    it('llama a onSearchChange al escribir', () => {
        const props = baseProps();
        render(<UnassignedSidebar {...props} />);
        fireEvent.change(screen.getByPlaceholderText('Buscar por título...'), { target: { value: 'rodamiento' } });
        expect(props.onSearchChange).toHaveBeenCalledWith('rodamiento');
    });

    it('llama a onSelectWO al pulsar la tarjeta', () => {
        const props = baseProps();
        render(<UnassignedSidebar {...props} />);
        fireEvent.click(screen.getByText('Cambio de rodamiento'));
        expect(props.onSelectWO).toHaveBeenCalledWith(wo);
    });

    it('llama a onAssign al elegir un técnico', () => {
        const props = baseProps();
        render(<UnassignedSidebar {...props} />);
        const select = screen.getByLabelText('Asignar tarea Cambio de rodamiento');
        fireEvent.change(select, { target: { value: 'tech1' } });
        expect(props.onAssign).toHaveBeenCalledWith(wo, 'tech1', expect.any(Date));
    });

    it('muestra mensaje de vacío cuando no hay órdenes', () => {
        render(<UnassignedSidebar {...baseProps()} unassignedWOs={[]} />);
        expect(screen.getByText('No hay órdenes pendientes de asignar.')).toBeTruthy();
    });
});
