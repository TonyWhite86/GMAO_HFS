import { describe, it, expect } from 'vitest';
import {
    filterStoppages, getOpenNow, getReasonOptions, getStoppageReasonLabel,
    hasActiveFilters, isOpenNow, EMPTY_STOPPAGE_FILTERS
} from './stoppageFilters';
import { EquipmentStoppage, StoppageReasonType, StoppageStatus } from '../types';

const stop = (over: Partial<EquipmentStoppage>): EquipmentStoppage => ({
    id: 's1', equipmentId: 'eq1', title: 'Parada', startAt: '2026-10-15T08:00:00Z',
    status: StoppageStatus.SCHEDULED, createdAt: '2026-10-14T08:00:00Z',
    ...over
});

describe('isOpenNow / getOpenNow', () => {
    it('abierta = sin fin y no cancelada', () => {
        expect(isOpenNow(stop({ endAt: null }))).toBe(true);
        expect(isOpenNow(stop({ endAt: undefined }))).toBe(true);
        expect(isOpenNow(stop({ endAt: '2026-10-15T10:00:00Z' }))).toBe(false);
        expect(isOpenNow(stop({ endAt: null, status: StoppageStatus.CANCELLED }))).toBe(false);
    });

    it('getOpenNow filtra las abiertas', () => {
        const open = getOpenNow([
            stop({ id: 'a', endAt: null }),
            stop({ id: 'b', endAt: '2026-10-15T10:00:00Z' }),
            stop({ id: 'c', status: StoppageStatus.IN_PROGRESS })
        ]);
        expect(open.map(s => s.id)).toEqual(['a', 'c']);
    });
});

describe('getStoppageReasonLabel / getReasonOptions', () => {
    it('prioriza la categoría de la incidencia sobre el reasonType', () => {
        expect(getStoppageReasonLabel(stop({ reasonType: StoppageReasonType.IMPROVEMENT, reasonLabel: 'Avería' }))).toBe('Avería');
        expect(getStoppageReasonLabel(stop({ reasonType: StoppageReasonType.THIRD_PARTY }))).toBe('Intervención de terceros');
    });

    it('lista de motivos distintos y ordenada', () => {
        const options = getReasonOptions([
            stop({ reasonLabel: 'Avería' }),
            stop({ reasonType: StoppageReasonType.IMPROVEMENT }),
            stop({ reasonLabel: 'Avería' })
        ]);
        expect(options).toEqual(['Avería', 'Mejora']);
    });
});

describe('filterStoppages', () => {
    const data = [
        stop({ id: 'a', equipmentId: 'eq1', title: 'Cambio de rodamientos', status: StoppageStatus.SCHEDULED, reasonType: StoppageReasonType.MAINTENANCE, endAt: '2026-10-15T12:00:00Z' }),
        stop({ id: 'b', equipmentId: 'eq2', title: 'Revisión externa', status: StoppageStatus.IN_PROGRESS, incidentId: 'inc1', reasonLabel: 'Avería', endAt: null }),
        stop({ id: 'c', equipmentId: 'eq1', title: 'Pintura', status: StoppageStatus.CANCELLED, reasonType: StoppageReasonType.IMPROVEMENT, endAt: null })
    ];

    it('sin filtros devuelve todo', () => {
        expect(filterStoppages(data)).toHaveLength(3);
        expect(hasActiveFilters(EMPTY_STOPPAGE_FILTERS)).toBe(false);
    });

    it('filtra por equipo', () => {
        expect(filterStoppages(data, { equipmentId: 'eq1' }).map(s => s.id)).toEqual(['a', 'c']);
    });

    it('filtra por estado', () => {
        expect(filterStoppages(data, { status: StoppageStatus.IN_PROGRESS }).map(s => s.id)).toEqual(['b']);
    });

    it('solo parados ahora descarta las cerradas y las canceladas abiertas', () => {
        expect(filterStoppages(data, { onlyOpenNow: true }).map(s => s.id)).toEqual(['b']);
    });

    it('filtra por motivo (etiqueta efectiva)', () => {
        expect(filterStoppages(data, { reason: 'Avería' }).map(s => s.id)).toEqual(['b']);
        expect(filterStoppages(data, { reason: 'Mantenimiento' }).map(s => s.id)).toEqual(['a']);
    });

    it('filtra por origen', () => {
        expect(filterStoppages(data, { origin: 'incident' }).map(s => s.id)).toEqual(['b']);
        expect(filterStoppages(data, { origin: 'manual' }).map(s => s.id)).toEqual(['a', 'c']);
    });

    it('busca en título y descripción sin acentos', () => {
        expect(filterStoppages(data, { search: 'rodamientos' }).map(s => s.id)).toEqual(['a']);
        expect(filterStoppages(data, { search: 'revision' }).map(s => s.id)).toEqual(['b']);
    });

    it('combina filtros y detecta filtros activos', () => {
        // eq1 solo tiene la 'a' (cerrada) y la 'c' (cancelada): ninguna está parada ahora
        expect(filterStoppages(data, { equipmentId: 'eq1', onlyOpenNow: true }).map(s => s.id)).toEqual([]);
        // eq2 sí tiene la 'b' abierta
        expect(filterStoppages(data, { equipmentId: 'eq2', onlyOpenNow: true }).map(s => s.id)).toEqual(['b']);
        expect(hasActiveFilters({ search: '  ' })).toBe(false);
        expect(hasActiveFilters({ onlyOpenNow: true })).toBe(true);
    });
});
