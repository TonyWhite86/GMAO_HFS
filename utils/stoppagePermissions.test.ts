import { describe, it, expect } from 'vitest';
import { canManageStoppage, canDeleteStoppage } from './stoppagePermissions';
import { EquipmentStoppage, StoppageStatus, User, UserRole } from '../types';

const admin = { id: 'u-admin', role: UserRole.ADMIN } as User;
const creator = { id: 'u-creator', role: UserRole.TECHNICIAN } as User;
const other = { id: 'u-other', role: UserRole.TECHNICIAN } as User;
const manager = { id: 'u-mgr', role: UserRole.SECTION_MANAGER } as User;

const st = (over: Partial<EquipmentStoppage> = {}): Pick<EquipmentStoppage, 'createdBy' | 'status' | 'incidentId'> => ({
    createdBy: creator.id,
    status: StoppageStatus.SCHEDULED,
    incidentId: null,
    ...over
});

describe('canManageStoppage', () => {
    it('Admin gestiona siempre', () => {
        expect(canManageStoppage(st(), admin)).toBe(true);
        expect(canManageStoppage(st({ status: StoppageStatus.COMPLETED }), admin)).toBe(true);
    });

    it('el creador gestiona la suya mientras esté abierta', () => {
        expect(canManageStoppage(st({ status: StoppageStatus.SCHEDULED }), creator)).toBe(true);
        expect(canManageStoppage(st({ status: StoppageStatus.IN_PROGRESS }), creator)).toBe(true);
    });

    it('el creador NO gestiona la suya si ya está cerrada', () => {
        expect(canManageStoppage(st({ status: StoppageStatus.COMPLETED }), creator)).toBe(false);
        expect(canManageStoppage(st({ status: StoppageStatus.CANCELLED }), creator)).toBe(false);
    });

    it('los demás no gestionan, aunque sean Responsable', () => {
        expect(canManageStoppage(st(), other)).toBe(false);
        expect(canManageStoppage(st(), manager)).toBe(false);
    });

    it('sin usuario no hay acceso', () => {
        expect(canManageStoppage(st(), null)).toBe(false);
    });
});

describe('canDeleteStoppage', () => {
    it('una parada de una incidencia NUNCA se borra, ni por Admin', () => {
        expect(canDeleteStoppage(st({ incidentId: 'inc1' }), admin)).toBe(false);
        expect(canDeleteStoppage(st({ incidentId: 'inc1' }), creator)).toBe(false);
    });

    it('lo cerrado sólo lo borra el Admin', () => {
        expect(canDeleteStoppage(st({ status: StoppageStatus.COMPLETED }), admin)).toBe(true);
        expect(canDeleteStoppage(st({ status: StoppageStatus.COMPLETED }), creator)).toBe(false);
    });

    it('lo abierto sin incidencia lo borra Admin o creador', () => {
        expect(canDeleteStoppage(st(), admin)).toBe(true);
        expect(canDeleteStoppage(st(), creator)).toBe(true);
        expect(canDeleteStoppage(st(), other)).toBe(false);
        expect(canDeleteStoppage(st(), manager)).toBe(false);
    });

    it('sin usuario no hay acceso', () => {
        expect(canDeleteStoppage(st(), null)).toBe(false);
    });
});
