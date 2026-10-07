import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityTimeline } from './ActivityTimeline';
import { WorkOrder, WOStatus, WOPriority, WOType, WorkOrderEventKind, Comment } from '../../types';

const wo = (over: Partial<WorkOrder> = {}): WorkOrder => ({
    id: 'wo1',
    title: 'Mensual preventivo',
    description: '',
    type: WOType.PREVENTIVE,
    status: WOStatus.COMPLETED,
    priority: WOPriority.MEDIUM,
    equipmentId: 'eq1',
    section: 'Mecanizado',
    createdBy: 'u-admin',
    createdAt: '2026-10-02T09:00:00Z',
    closedAt: '2026-10-02T18:20:00Z',
    timeSpentMinutes: 12,
    timeSource: 'manual',
    statusHistory: [],
    events: [],
    attachments: [],
    usedParts: [],
    comments: [],
    ...over
});

const ev = (over: Record<string, unknown> = {}) => ({
    id: 'e1',
    workOrderId: 'wo1',
    kind: WorkOrderEventKind.CREATE,
    status: null,
    note: null,
    actorId: 'u1',
    actorName: 'Ana García',
    createdAt: '2026-10-02T09:00:00Z',
    ...over
});

const render_ = (workOrder: WorkOrder, comments: Comment[] = []) =>
    render(<ActivityTimeline workOrder={workOrder} comments={comments} setViewMedia={vi.fn()} />);

describe('ActivityTimeline', () => {
    it('muestra el evento de creación con actor y hora', () => {
        render_(wo({ events: [ev()] }));
        expect(screen.getByText('Orden creada')).toBeTruthy();
        expect(screen.getByText('Ana García')).toBeTruthy();
        // la hora va dentro del mensaje
        expect(screen.getByText(/02\/10\/2026/)).toBeTruthy();
    });

    it('muestra la pausa con su motivo', () => {
        render_(wo({
            events: [
                ev({ id: 'e1', kind: WorkOrderEventKind.STATUS, status: 'En Progreso', createdAt: '2026-10-02T14:30:00Z' }),
                ev({ id: 'e2', kind: WorkOrderEventKind.PAUSE, note: 'falta de material', createdAt: '2026-10-02T16:00:00Z' })
            ]
        }));
        expect(screen.getByText('Inicio del trabajo')).toBeTruthy();
        expect(screen.getByText('Trabajo pausado')).toBeTruthy();
        expect(screen.getByText('Motivo: falta de material')).toBeTruthy();
    });

    it('muestra el fin con la hora y el tiempo, marcando lo manual', () => {
        render_(wo({ events: [ev({ kind: WorkOrderEventKind.COMPLETE })] }));
        expect(screen.getByText('Orden completada')).toBeTruthy();
        expect(screen.getByText(/Fin: .* · Tiempo: 12m · registrado a mano/)).toBeTruthy();
        expect(screen.getByText('Manual')).toBeTruthy();
    });

    it('intercala comentarios con los eventos ordenados por fecha', () => {
        const comments: Comment[] = [{
            id: 'c1', userId: 'u2', userName: 'Luis Pérez', text: 'Ya está, era el rodamiento',
            createdAt: '2026-10-02T18:25:00Z'
        }];
        render_(wo({ events: [ev()] }), comments);
        const items = screen.getAllByText(/Orden creada|Ya está/);
        expect(items).toHaveLength(2);
        // el comentario va después del evento de creación
        expect(items[0].textContent).toContain('Orden creada');
        expect(items[1].textContent).toContain('Ya está');
    });

    it('muestra mensaje vacío cuando no hay nada', () => {
        render_(wo());
        expect(screen.getByText('Todavía no hay actividad registrada.')).toBeTruthy();
    });
});
