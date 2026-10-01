import { describe, it, expect } from 'vitest';
import { WOStatus } from '../types';
import {
    extractTimeSessions,
    computeActiveSeconds,
    computeActiveMinutes,
    hasActiveSession,
    getDayOverlap,
    formatDuration,
} from './timeTracking';

const { PENDING, IN_PROGRESS } = WOStatus;
const HOUR = 3600;

describe('extractTimeSessions', () => {
    it('devuelve [] sin historial', () => {
        expect(extractTimeSessions(undefined)).toEqual([]);
        expect(extractTimeSessions([])).toEqual([]);
    });

    it('empareja IN_PROGRESS con su cierre', () => {
        const sessions = extractTimeSessions([
            { status: IN_PROGRESS, timestamp: '2026-07-15T09:00:00Z' },
            { status: PENDING, timestamp: '2026-07-15T10:00:00Z' },
        ]);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].isActive).toBe(false);
        expect(sessions[0].start.toISOString()).toBe('2026-07-15T09:00:00.000Z');
        expect(sessions[0].end.toISOString()).toBe('2026-07-15T10:00:00.000Z');
    });

    it('marca como activa la sesión abierta al final', () => {
        const sessions = extractTimeSessions([{ status: IN_PROGRESS, timestamp: '2026-07-15T09:00:00Z' }]);
        expect(sessions).toHaveLength(1);
        expect(sessions[0].isActive).toBe(true);
    });

    it('ordena cronológicamente aunque llegue desordenado', () => {
        const sessions = extractTimeSessions([
            { status: PENDING, timestamp: '2026-07-15T10:00:00Z' },
            { status: IN_PROGRESS, timestamp: '2026-07-15T09:00:00Z' },
        ]);
        expect(sessions[0].start.toISOString()).toBe('2026-07-15T09:00:00.000Z');
        expect(sessions[0].end.toISOString()).toBe('2026-07-15T10:00:00.000Z');
    });
});

describe('computeActiveMinutes / computeActiveSeconds', () => {
    it('usa savedMinutes solo cuando no hay historial', () => {
        expect(computeActiveMinutes(IN_PROGRESS, undefined, 90)).toBe(90);
    });

    it('deriva del historial sin mezclar savedMinutes (sin doble conteo)', () => {
        const minutes = computeActiveMinutes(IN_PROGRESS, [
            { status: IN_PROGRESS, timestamp: '2026-07-15T09:00:00Z' },
            { status: PENDING, timestamp: '2026-07-15T10:00:00Z' },
            { status: IN_PROGRESS, timestamp: '2026-07-15T11:00:00Z' },
            { status: PENDING, timestamp: '2026-07-15T12:00:00Z' },
        ], 999);
        expect(minutes).toBe(120);
    });

    it('una sesión abierta suma desde su inicio hasta ahora', () => {
        const seconds = computeActiveSeconds(IN_PROGRESS, [
            { status: IN_PROGRESS, timestamp: new Date(Date.now() - HOUR * 1000).toISOString() },
        ]);
        expect(seconds).toBeGreaterThanOrEqual(HOUR);
        expect(seconds).toBeLessThan(HOUR + 5);
    });

    it('WO completada no suma la sesión abierta como activa', () => {
        const seconds = computeActiveSeconds(WOStatus.COMPLETED, [
            { status: IN_PROGRESS, timestamp: '2026-07-15T09:00:00Z' },
        ]);
        expect(seconds).toBe(0);
    });
});

describe('hasActiveSession', () => {
    it('true si la última sesión está abierta (en marcha)', () => {
        expect(hasActiveSession([{ status: IN_PROGRESS, timestamp: '2026-07-15T09:00:00Z' }])).toBe(true);
    });

    it('false si la última está cerrada (pausada)', () => {
        expect(hasActiveSession([
            { status: IN_PROGRESS, timestamp: '2026-07-15T09:00:00Z' },
            { status: PENDING, timestamp: '2026-07-15T10:00:00Z' },
        ])).toBe(false);
    });

    it('false sin historial', () => {
        expect(hasActiveSession(undefined)).toBe(false);
        expect(hasActiveSession([])).toBe(false);
    });
});

describe('getDayOverlap', () => {
    it('turno de noche 22:00-06:00 se reparte entre dos días', () => {
        const day1 = new Date(2026, 6, 13);
        const day2 = new Date(2026, 6, 14);
        const session = {
            start: new Date(2026, 6, 13, 22, 0),
            end: new Date(2026, 6, 14, 6, 0),
            isActive: false,
        };
        const o1 = getDayOverlap(session, day1)!;
        const o2 = getDayOverlap(session, day2)!;
        expect(o1.start.getHours()).toBe(22);
        expect(o1.end.getHours()).toBe(23);
        expect(o2.start.getHours()).toBe(0);
        expect(o2.end.getHours()).toBe(6);
    });

    it('devuelve null si la sesión no toca ese día', () => {
        const day = new Date(2026, 6, 15);
        const session = {
            start: new Date(2026, 6, 13, 22, 0),
            end: new Date(2026, 6, 14, 6, 0),
            isActive: false,
        };
        expect(getDayOverlap(session, day)).toBeNull();
    });
});

describe('formatDuration', () => {
    it('formatea horas y minutos', () => {
        expect(formatDuration(90)).toBe('1h 30m');
        expect(formatDuration(45)).toBe('45m');
        expect(formatDuration(0)).toBe('0m');
    });
});
