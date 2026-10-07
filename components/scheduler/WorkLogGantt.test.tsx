import { describe, it, expect } from 'vitest';
import { extractSessions } from './WorkLogGantt';
import { WorkOrder, WOStatus, WOPriority, WOType } from '../../types';

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
    closedAt: '2026-10-02T12:00:00Z',
    statusHistory: [],
    attachments: [],
    usedParts: [],
    comments: [],
    ...over
});

describe('extractSessions (WorkLogGantt)', () => {
    it('sin sesiones en status_history y sin tiempo manual, no devuelve nada', () => {
        expect(extractSessions(wo({ timeSource: null, timeSpentMinutes: 0 }))).toHaveLength(0);
    });

    it('sintetiza un bloque manual con el tiempo registrado', () => {
        const sessions = extractSessions(wo({
            assignedUserId: 'tech1',
            timeSource: 'manual',
            timeSpentMinutes: 12
        }));
        expect(sessions).toHaveLength(1);
        expect(sessions[0].isManual).toBe(true);
        const mins = Math.round((sessions[0].end.getTime() - sessions[0].start.getTime()) / 60000);
        expect(mins).toBe(12);
    });

    it('el bloque manual termina en closedAt', () => {
        const sessions = extractSessions(wo({
            assignedUserId: 'tech1',
            closedAt: '2026-10-02T12:00:00Z',
            timeSource: 'manual',
            timeSpentMinutes: 30
        }));
        expect(sessions[0].end.toISOString()).toBe('2026-10-02T12:00:00.000Z');
    });

    it('atribuye el bloque a quien registró el tiempo si la OT no tiene asignado', () => {
        const sessions = extractSessions(wo({
            assignedUserId: undefined,
            collaborators: [],
            timeRecordedBy: 'tech1',
            timeSource: 'manual',
            timeSpentMinutes: 12
        }));
        expect(sessions).toHaveLength(1);
        expect(sessions[0].userId).toBe('tech1');
    });

    it('con tiempo medido usa las sesiones del historial y no marca manual', () => {
        const sessions = extractSessions(wo({
            assignedUserId: 'tech1',
            timeSource: 'sesion',
            timeSpentMinutes: 60,
            statusHistory: [
                { status: WOStatus.IN_PROGRESS, timestamp: '2026-10-02T10:00:00Z' },
                { status: WOStatus.COMPLETED, timestamp: '2026-10-02T11:00:00Z' }
            ]
        }));
        expect(sessions).toHaveLength(1);
        expect(sessions[0].isManual).toBe(false);
        const mins = Math.round((sessions[0].end.getTime() - sessions[0].start.getTime()) / 60000);
        expect(mins).toBe(60);
    });
});
