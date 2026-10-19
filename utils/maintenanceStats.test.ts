import { describe, it, expect } from 'vitest';
import {
    getDueLabel, getDueTone, quickDate, groupByTimeframe,
    hasPendingChecklist, getEffectiveDate
} from './maintenanceStats';
import { WorkOrder, WOStatus, WOType, WOPriority } from '../types';

const NOW = new Date(2026, 9, 15, 12, 0, 0); // 15 oct 2026, 12:00 local
const iso = (y: number, m: number, d: number, h = 8) => new Date(y, m, d, h, 0, 0).toISOString();

const wo = (over: Partial<WorkOrder>): WorkOrder => ({
    id: 'OT-1', title: 'T', description: '', type: WOType.CORRECTIVE, status: WOStatus.PENDING,
    priority: WOPriority.MEDIUM, equipmentId: 'eq1', createdBy: 'u1',
    createdAt: iso(2026, 9, 10), section: 'S',
    attachments: [], usedParts: [], comments: [],
    ...over
});

describe('getDueLabel / getDueTone', () => {
    it('marca vencida, hoy y mañana', () => {
        expect(getDueLabel(wo({ scheduledDate: iso(2026, 9, 14) }), NOW)).toBe('Vencida');
        expect(getDueLabel(wo({ scheduledDate: iso(2026, 9, 15) }), NOW)).toBe('Hoy');
        expect(getDueLabel(wo({ scheduledDate: iso(2026, 9, 16) }), NOW)).toBe('Mañana');
        expect(getDueLabel(wo({ scheduledDate: iso(2026, 9, 20) }), NOW)).toBeNull();
    });

    it('las completadas pasadas no se marcan vencidas', () => {
        expect(getDueLabel(wo({ scheduledDate: iso(2026, 9, 10), status: WOStatus.COMPLETED }), NOW)).toBeNull();
    });

    it('sin scheduledDate usa createdAt', () => {
        expect(getDueLabel(wo({ scheduledDate: undefined, createdAt: iso(2026, 9, 15, 7) }), NOW)).toBe('Hoy');
        expect(getEffectiveDate(wo({ scheduledDate: undefined, createdAt: iso(2026, 9, 15, 7) })).getTime()).toBe(new Date(iso(2026, 9, 15, 7)).getTime());
    });

    it('tonos de color', () => {
        expect(getDueTone(wo({ scheduledDate: iso(2026, 9, 14) }), NOW)).toBe('ko');
        expect(getDueTone(wo({ scheduledDate: iso(2026, 9, 15) }), NOW)).toBe('warn');
        expect(getDueTone(wo({ scheduledDate: iso(2026, 9, 16) }), NOW)).toBe('accent');
        expect(getDueTone(wo({ scheduledDate: iso(2026, 9, 20) }), NOW)).toBeNull();
    });
});

describe('quickDate', () => {
    it('suma n días desde hoy a las 08:00', () => {
        const res = quickDate(7, NOW);
        const d = new Date(res);
        expect(d.getHours()).toBe(8);
        // 15 oct + 7 = 22 oct
        expect(d.getDate()).toBe(22);
        expect(d.getMonth()).toBe(9);
    });
});

describe('groupByTimeframe', () => {
    it('agrupa por hoy/mañana/semana/próximas', () => {
        const groups = groupByTimeframe([
            wo({ id: 'hoy', scheduledDate: iso(2026, 9, 15) }),
            wo({ id: 'ayer', scheduledDate: iso(2026, 9, 14) }),
            wo({ id: 'manana', scheduledDate: iso(2026, 9, 16) }),
            wo({ id: 'semana', scheduledDate: iso(2026, 9, 18) }),
            wo({ id: 'lejos', scheduledDate: iso(2026, 10, 20) })
        ], NOW);
        expect(groups.hoy.map(w => w.id)).toEqual(['hoy', 'ayer']);
        expect(groups.manana.map(w => w.id)).toEqual(['manana']);
        expect(groups.estaSemana.map(w => w.id)).toEqual(['semana']);
        expect(groups.proximas.map(w => w.id)).toEqual(['lejos']);
    });
});

describe('hasPendingChecklist', () => {
    it('detecta checklists sin responder', () => {
        const base = { closureChecklist: [{ id: 'a', text: 'x' }] };
        expect(hasPendingChecklist(wo({ ...base }))).toBe(true);
        expect(hasPendingChecklist(wo({ ...base, checklistAnswers: { a: { sel: 'si' } } }))).toBe(false);
        expect(hasPendingChecklist(wo({ ...base, status: WOStatus.COMPLETED }))).toBe(false);
        expect(hasPendingChecklist(wo({}))).toBe(false);
    });
});
