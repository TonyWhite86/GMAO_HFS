import { describe, it, expect } from 'vitest';
import { expandTargetEquipment, staggerStartDates, resolvePlanSummary } from './preventiveTargets';
import { PreventivePlanTarget } from '../types';

const groups = [
    { id: 'g1', name: 'Detectores de metales', equipmentIds: ['e1', 'e2', 'e3'] },
    { id: 'g2', name: 'Bombas', equipmentIds: ['e3', 'e4'] }
];

describe('expandTargetEquipment', () => {
    it('une equipos sueltos y grupos sin duplicados', () => {
        const { equipmentIds, byGroup } = expandTargetEquipment(
            { equipmentIds: ['e9'], groupIds: ['g1', 'g2'] }, groups
        );
        expect(equipmentIds).toEqual(['e9', 'e1', 'e2', 'e3', 'e4']);
        expect(byGroup.g1).toEqual(['e1', 'e2', 'e3']);
        expect(byGroup.g2).toEqual(['e3', 'e4']);
    });

    it('sin selección devuelve vacío y tolera grupos inexistentes', () => {
        expect(expandTargetEquipment({ equipmentIds: [], groupIds: [] }, groups).equipmentIds).toEqual([]);
        expect(expandTargetEquipment({ equipmentIds: [], groupIds: ['nope'] }, groups).equipmentIds).toEqual([]);
    });
});

describe('staggerStartDates', () => {
    it('sin escalonado: todas la misma fecha', () => {
        const base = new Date(2026, 9, 15);
        const dates = staggerStartDates(3, 0, base);
        expect(new Set(dates).size).toBe(1);
    });

    it('escalonado: i × X días desde la base', () => {
        const base = new Date(2026, 9, 15);
        const dates = staggerStartDates(3, 2, base).map(d => new Date(d));
        expect(dates[1].getDate()).toBe(17);
        expect(dates[2].getDate()).toBe(19);
    });
});

describe('resolvePlanSummary', () => {
    const target = (over: Partial<PreventivePlanTarget>): PreventivePlanTarget => ({
        id: 't1', planId: 'p1', equipmentId: 'e1',
        nextRun: '2026-10-20T08:00:00Z', ...over
    });

    it('resume equipos, grupos, directos y vencidos', () => {
        const now = new Date('2026-10-15T12:00:00Z');
        const summary = resolvePlanSummary([
            target({ id: 'a', equipmentId: 'e1', sourceGroupId: 'g1', nextRun: '2026-10-10T08:00:00Z' }),
            target({ id: 'b', equipmentId: 'e2', sourceGroupId: 'g1', nextRun: '2026-10-18T08:00:00Z' }),
            target({ id: 'c', equipmentId: 'e9', sourceGroupId: null, nextRun: '2026-10-25T08:00:00Z' })
        ], groups, now);
        expect(summary.equipmentCount).toBe(3);
        expect(summary.groupNames).toEqual(['Detectores de metales']);
        expect(summary.directCount).toBe(1);
        expect(summary.overdueCount).toBe(1);
        expect(summary.nextRun).toBe('2026-10-10T08:00:00Z');
    });

    it('sin objetivos', () => {
        expect(resolvePlanSummary([], groups)).toEqual({
            equipmentCount: 0, groupNames: [], directCount: 0, overdueCount: 0, nextRun: null
        });
    });
});
