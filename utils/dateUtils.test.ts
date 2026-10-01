import { describe, it, expect } from 'vitest';
import {
    toLocalDateStr,
    getMondayOfWeek,
    getDaysToShow,
    navigateDate,
    formatHeaderLabel,
} from './dateUtils';

describe('toLocalDateStr', () => {
    it('formatea como YYYY-MM-DD local', () => {
        expect(toLocalDateStr(new Date(2026, 6, 5))).toBe('2026-07-05');
    });
});

describe('getMondayOfWeek', () => {
    it('miércoles → lunes de su semana', () => {
        const wednesday = new Date(2026, 6, 15);
        expect(toLocalDateStr(getMondayOfWeek(wednesday))).toBe('2026-07-13');
    });

    it('domingo pertenece a la semana del lunes anterior', () => {
        const sunday = new Date(2026, 6, 19);
        expect(toLocalDateStr(getMondayOfWeek(sunday))).toBe('2026-07-13');
    });

    it('el propio lunes no cambia', () => {
        expect(toLocalDateStr(getMondayOfWeek(new Date(2026, 6, 13)))).toBe('2026-07-13');
    });
});

describe('getDaysToShow', () => {
    it('vista día devuelve solo el día', () => {
        const days = getDaysToShow('day', new Date(2026, 6, 15), false);
        expect(days).toHaveLength(1);
        expect(toLocalDateStr(days[0])).toBe('2026-07-15');
    });

    it('vista semana sin domingo devuelve lunes-sábado (6 días)', () => {
        const days = getDaysToShow('week', new Date(2026, 6, 15), false);
        expect(days).toHaveLength(6);
        expect(toLocalDateStr(days[0])).toBe('2026-07-13');
        expect(toLocalDateStr(days[5])).toBe('2026-07-18');
    });

    it('vista semana con domingo devuelve 7 días', () => {
        const days = getDaysToShow('week', new Date(2026, 6, 15), true);
        expect(days).toHaveLength(7);
        expect(toLocalDateStr(days[6])).toBe('2026-07-19');
    });
});

describe('navigateDate', () => {
    it('día: avanza/retrocede un día', () => {
        const base = new Date(2026, 6, 15);
        expect(toLocalDateStr(navigateDate(base, 'day', 'next'))).toBe('2026-07-16');
        expect(toLocalDateStr(navigateDate(base, 'day', 'prev'))).toBe('2026-07-14');
    });

    it('semana: avanza/retrocede 7 días', () => {
        const base = new Date(2026, 6, 15);
        expect(toLocalDateStr(navigateDate(base, 'week', 'next'))).toBe('2026-07-22');
        expect(toLocalDateStr(navigateDate(base, 'week', 'prev'))).toBe('2026-07-08');
    });
});

describe('formatHeaderLabel', () => {
    it('vista día muestra la fecha larga', () => {
        const label = formatHeaderLabel('day', new Date(2026, 6, 15), [new Date(2026, 6, 15)]);
        expect(label).toContain('2026');
    });

    it('vista semana usa el primer día mostrado', () => {
        const days = getDaysToShow('week', new Date(2026, 6, 15), false);
        expect(formatHeaderLabel('week', new Date(2026, 6, 15), days)).toBe('Semana del 13 de julio');
    });
});
