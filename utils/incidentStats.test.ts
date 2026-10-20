import { describe, it, expect } from 'vitest';
import { computeIncidentStats, computeMonthlySeries, computeDistribution } from './incidentStats';
import { Incident, IncidentStatus, WOPriority } from '../types';

const inc = (over: Partial<Incident>): Incident => ({
    id: 'i1', title: 'T', description: 'D', priority: WOPriority.MEDIUM,
    status: IncidentStatus.OPEN, createdBy: 'u1', createdAt: '2026-07-15T10:00:00Z',
    ...over
});

describe('computeIncidentStats', () => {
    it('cuenta por estado y tasas', () => {
        const stats = computeIncidentStats([
            inc({ status: IncidentStatus.OPEN }),
            inc({ status: IncidentStatus.IN_PROGRESS }),
            inc({ status: IncidentStatus.PAUSED_MATERIAL }),
            inc({ status: IncidentStatus.PAUSED_BUDGET }),
            inc({ status: IncidentStatus.PAUSED_EXTERNAL }),
            inc({ status: IncidentStatus.SCHEDULED, workOrderId: 'OT-1' }),
            inc({ status: IncidentStatus.PENDING_CLOSE, resolvedAt: '2026-07-16T10:00:00Z' }),
            inc({ status: IncidentStatus.CLOSED, resolvedAt: '2026-07-17T10:00:00Z' })
        ]);
        expect(stats.total).toBe(8);
        expect(stats.open).toBe(1);
        expect(stats.inProgress).toBe(1);
        expect(stats.pausedMaterial).toBe(1);
        expect(stats.pausedBudget).toBe(1);
        expect(stats.pausedExternal).toBe(1);
        expect(stats.scheduled).toBe(1);
        expect(stats.pendingClose).toBe(1);
        expect(stats.closed).toBe(1);
        expect(stats.resolutionRate).toBe(13);
    });

    it('tiempo medio de resolución en días', () => {
        const stats = computeIncidentStats([
            inc({ status: IncidentStatus.CLOSED, createdAt: '2026-07-15T10:00:00Z', resolvedAt: '2026-07-17T10:00:00Z' }),
            inc({ status: IncidentStatus.CLOSED, createdAt: '2026-07-15T10:00:00Z', resolvedAt: '2026-07-16T10:00:00Z' })
        ]);
        expect(stats.avgResolutionDays).toBe(1.5);
    });

    it('sin fechas de resolución no hay media', () => {
        expect(computeIncidentStats([inc({})]).avgResolutionDays).toBeNull();
    });

    it('una propuesta pendiente usa su resolved_at en la media', () => {
        const stats = computeIncidentStats([
            inc({ status: IncidentStatus.PENDING_CLOSE, createdAt: '2026-07-15T10:00:00Z', resolvedAt: '2026-07-16T10:00:00Z' }),
            inc({ status: IncidentStatus.PENDING_CLOSE })
        ]);
        expect(stats.pendingClose).toBe(2);
        expect(stats.closed).toBe(0);
        expect(stats.avgResolutionDays).toBe(1);
    });

    it('lista vacía', () => {
        const stats = computeIncidentStats([]);
        expect(stats.total).toBe(0);
        expect(stats.resolutionRate).toBe(0);
    });
});

describe('computeMonthlySeries', () => {
    it('genera 12 meses y cuenta por mes', () => {
        const now = new Date('2026-07-15T12:00:00Z');
        const series = computeMonthlySeries([
            inc({ createdAt: '2026-07-01T00:00:00Z' }),
            inc({ createdAt: '2026-07-20T00:00:00Z' }),
            inc({ createdAt: '2026-06-10T00:00:00Z' }),
            inc({ createdAt: '2025-01-01T00:00:00Z' }) // fuera de rango
        ], now);
        expect(series).toHaveLength(12);
        const jul = series.find(s => s.key === '2026-07');
        const jun = series.find(s => s.key === '2026-06');
        expect(jul?.count).toBe(2);
        expect(jun?.count).toBe(1);
        expect(series.find(s => s.key === '2025-01')).toBeUndefined();
    });
});

describe('computeDistribution', () => {
    it('agrupa, ordena por frecuencia y usa fallback', () => {
        const dist = computeDistribution([
            inc({ section: 'Mecanizado' }),
            inc({ section: 'Mecanizado' }),
            inc({ section: 'Calidad' }),
            inc({})
        ], i => i.section || '');
        expect(dist[0]).toEqual({ value: 'Mecanizado', count: 2 });
        expect(dist).toContainEqual({ value: 'Calidad', count: 1 });
        expect(dist).toContainEqual({ value: 'Sin asignar', count: 1 });
    });
});
