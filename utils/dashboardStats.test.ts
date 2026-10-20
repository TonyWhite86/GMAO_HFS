import { describe, it, expect } from 'vitest';
import {
    getMyTodayWOs, getMyTomorrowWOs, computeWoWeeklyTrend, computeHoursDailyTrend,
    computeIncidentsDailyTrend, computeOnTimePct, computeChecklistPct,
    getPreventiveSummary, computePreventivePct, getExternalWoSummary, getRecentActivity
} from './dashboardStats';
import { Incident, IncidentStatus, PreventivePlan, WorkOrder, WOStatus, WOPriority, WOType } from '../types';

const wo = (over: Partial<WorkOrder>): WorkOrder => ({
    id: 'OT-1', title: 'T', description: '', type: WOType.CORRECTIVE, status: WOStatus.PENDING,
    priority: WOPriority.MEDIUM, createdBy: 'u1', createdAt: '2026-10-12T08:00:00Z', section: 'S',
    equipmentId: 'eq1',
    attachments: [],
    usedParts: [],
    comments: [],
    ...over
});

const inc = (over: Partial<Incident>): Incident => ({
    id: 'i1', title: 'I', description: '', priority: WOPriority.MEDIUM,
    status: IncidentStatus.OPEN, createdBy: 'u1', createdAt: '2026-10-12T08:00:00Z',
    ...over
});

const NOW = new Date('2026-10-15T12:00:00Z');

describe('getMyTodayWOs / getMyTomorrowWOs', () => {
    it('hoy incluye las programadas para hoy o antes, no completadas, propias', () => {
        const list = [
            wo({ id: 'a', assignedUserId: 'u1', scheduledDate: '2026-10-15T09:00:00Z' }),
            wo({ id: 'b', assignedUserId: 'u1', scheduledDate: '2026-10-14T09:00:00Z' }),
            wo({ id: 'c', assignedUserId: 'u1', scheduledDate: '2026-10-16T09:00:00Z' }),
            wo({ id: 'd', assignedUserId: 'u2', scheduledDate: '2026-10-15T09:00:00Z' }),
            wo({ id: 'e', assignedUserId: 'u1', status: WOStatus.COMPLETED, scheduledDate: '2026-10-15T09:00:00Z' })
        ];
        expect(getMyTodayWOs(list, 'u1', NOW).map(w => w.id)).toEqual(['a', 'b']);
    });

    it('mañana solo las programadas para mañana', () => {
        const list = [
            wo({ id: 'a', assignedUserId: 'u1', scheduledDate: '2026-10-16T09:00:00Z' }),
            wo({ id: 'b', assignedUserId: 'u1', scheduledDate: '2026-10-15T09:00:00Z' })
        ];
        expect(getMyTomorrowWOs(list, 'u1', NOW).map(w => w.id)).toEqual(['a']);
    });
});

describe('tendencias', () => {
    it('OTs por semana: creadas y completadas (ventanas rodantes de 7 días)', () => {
        const trend = computeWoWeeklyTrend([
            wo({ id: 'vieja', createdAt: '2026-10-12T08:00:00Z', closedAt: '2026-10-12T10:00:00Z' }),
            wo({ id: 'hoy', createdAt: '2026-10-15T08:00:00Z' })
        ], 2, NOW);
        expect(trend).toHaveLength(2);
        // ventana [10-08 .. 10-14]
        expect(trend[0].created).toBe(1);
        expect(trend[0].completed).toBe(1);
        // ventana [10-15 .. hoy]
        expect(trend[1].created).toBe(1);
        expect(trend[1].completed).toBe(0);
    });

    it('horas por día', () => {
        const hours = computeHoursDailyTrend([
            wo({ closedAt: '2026-10-15T10:00:00Z', timeSpentMinutes: 120 }),
            wo({ closedAt: '2026-10-15T11:00:00Z', timeSpentMinutes: 60 })
        ], 7, NOW);
        expect(hours).toHaveLength(7);
        expect(hours[6]).toBe(3);
    });

    it('incidencias por día', () => {
        const days = computeIncidentsDailyTrend([
            inc({ createdAt: '2026-10-15T08:00:00Z' }),
            inc({ createdAt: '2026-10-15T09:00:00Z' }),
            inc({ createdAt: '2026-10-10T09:00:00Z' })
        ], 7, NOW);
        expect(days[6]).toBe(2);
    });
});

describe('KPIs de calidad', () => {
    it('% de OTs a tiempo', () => {
        const pct = computeOnTimePct([
            wo({ scheduledDate: '2026-10-15T12:00:00Z', closedAt: '2026-10-15T10:00:00Z' }),
            wo({ scheduledDate: '2026-10-15T12:00:00Z', closedAt: '2026-10-15T14:00:00Z' }),
            wo({ scheduledDate: '2026-10-15T12:00:00Z', closedAt: '2026-10-15T12:00:00Z' })
        ]);
        expect(pct).toBe(67);
        expect(computeOnTimePct([wo({})])).toBeNull();
    });

    it('% de checklists completos', () => {
        const pct = computeChecklistPct([
            wo({ closureChecklist: [{ id: 'a', text: 'x' }], checklistAnswers: { a: { sel: 'si' } } }),
            wo({ closureChecklist: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }], checklistAnswers: { a: { sel: 'no' } } }),
            wo({})
        ]);
        expect(pct).toBe(50);
        expect(computeChecklistPct([wo({})])).toBeNull();
    });

    it('cumplimiento de preventivos', () => {
        const plans = [
            { id: 'p1', nextRun: '2026-10-14T00:00:00Z' },
            { id: 'p2', nextRun: '2026-10-18T00:00:00Z' },
            { id: 'p3', nextRun: '2026-11-30T00:00:00Z' }
        ] as PreventivePlan[];
        const sum = getPreventiveSummary(plans, NOW);
        expect(sum.overdue).toBe(1);
        expect(sum.thisWeek).toBe(1);
        expect(sum.next?.id).toBe('p1');
        expect(computePreventivePct(plans, NOW)).toBe(67);
    });
});

describe('OTs externas y actividad', () => {
    it('externas abiertas con precio acumulado', () => {
        const { open, totalPrice } = getExternalWoSummary([
            wo({ id: 'x1', isExternal: true, externalPrice: 100 }),
            wo({ id: 'x2', isExternal: true, externalPrice: 50.5, status: WOStatus.COMPLETED }),
            wo({ id: 'x3', isExternal: false, externalPrice: 999 })
        ]);
        expect(open.map(w => w.id)).toEqual(['x1']);
        expect(totalPrice).toBe(100);
    });

    it('actividad reciente mezcla eventos de OT y comentarios de incidencias, ordenada', () => {
        const entries = getRecentActivity([
            wo({ id: 'OT-9', title: 'Cambiar filtro', events: [{ id: 'e1', workOrderId: 'OT-9', kind: 'complete', actorName: 'Ana', createdAt: '2026-10-15T10:00:00Z' }] as any })
        ], [
            inc({ id: 'i9', title: 'Fuga', comments: [{ id: 'c1', incidentId: 'i9', userId: 'u2', userName: 'Luis', text: 'Revisada', createdAt: '2026-10-15T11:00:00Z' }] as any })
        ], 10);
        expect(entries.map(e => e.id)).toEqual(['c-c1', 'ev-e1']);
        expect(entries[0].kind).toBe('incident');
        expect(entries[1].text).toBe('completada');
    });
});
