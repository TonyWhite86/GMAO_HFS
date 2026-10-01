import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { usePermissions } from './usePermissions';
import { useAppStore } from '../store/useAppStore';
import { User, UserRole, PermissionLevel } from '../types';

const admin: User = { id: 'u1', name: 'Admin', email: '', role: UserRole.ADMIN, sections: [], active: true };
const manager: User = { id: 'u2', name: 'Manager', email: '', role: UserRole.SECTION_MANAGER, sections: ['Planta'], active: true };
const technician: User = { id: 'u3', name: 'Tech', email: '', role: UserRole.TECHNICIAN, sections: ['Planta', 'Almacén'], active: true };
const observerN1: User = { id: 'u4', name: 'Obs1', email: '', role: UserRole.OBSERVER_L1, sections: [], active: true };
const observerN2: User = { id: 'u5', name: 'Obs2', email: '', role: UserRole.OBSERVER_L2, sections: [], active: true };

const setInventoryPermission = (userId: string, level: PermissionLevel) => {
    useAppStore.setState({ userPermissions: [{ id: 'p-inv', userId, module: 'inventory', level }] });
};

// usePermissions is a React hook (it subscribes to the store), so it must be
// invoked inside a rendered component. Mounting a probe component with a live
// root (flushSync) reads the current store state, unlike renderToString which
// would fall back to the initial server snapshot.
const run = (user: User | null): ReturnType<typeof usePermissions> => {
    let result!: ReturnType<typeof usePermissions>;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const Probe = () => {
        result = usePermissions(user);
        return null;
    };
    flushSync(() => root.render(React.createElement(Probe)));
    root.unmount();
    container.remove();
    return result;
};

beforeEach(() => {
    useAppStore.setState({ userPermissions: [] });
});

describe('usePermissions', () => {
    describe('roles identificados correctamente', () => {
        it('detecta Admin', () => {
            expect(run(admin).isAdmin).toBe(true);
            expect(run(admin).isTechnician).toBe(false);
        });

        it('detecta Observador', () => {
            expect(run(observerN1).isObserver).toBe(true);
            expect(run(observerN2).isObserver).toBe(true);
            expect(run(technician).isObserver).toBe(false);
        });
    });

    describe('permisos de gestión', () => {
        it('solo Admin puede gestionar usuarios', () => {
            expect(run(admin).canManageUsers).toBe(true);
            expect(run(manager).canManageUsers).toBe(false);
            expect(run(technician).canManageUsers).toBe(false);
        });

        it('Admin y Responsable pueden gestionar planes preventivos', () => {
            expect(run(admin).canManagePreventivePlans).toBe(true);
            expect(run(manager).canManagePreventivePlans).toBe(true);
            expect(run(technician).canManagePreventivePlans).toBe(false);
        });

        it('solo Admin puede gestionar equipos', () => {
            expect(run(admin).canManageEquipment).toBe(true);
            expect(run(manager).canManageEquipment).toBe(false);
        });
    });

    describe('permisos de inventario (basados en userPermissions)', () => {
        it('Admin tiene acceso total', () => {
            const r = run(admin);
            expect(r.canManageInventory).toBe(true);
            expect(r.canEditInventoryItems).toBe(true);
            expect(r.canCreateInventoryItems).toBe(true);
            expect(r.canViewPrices).toBe(true);
        });

        it('sin permiso no tiene acceso (la sección Almacén ya no concede acceso)', () => {
            const r = run(technician);
            expect(r.canManageInventory).toBe(false);
            expect(r.canViewPrices).toBe(false);
            expect(r.canEditInventoryItems).toBe(false);
            expect(r.canCreateInventoryItems).toBe(false);
        });

        it('permiso parcial permite gestionar pero no editar ni fusionar', () => {
            setInventoryPermission(technician.id, 'parcial');
            const r = run(technician);
            expect(r.canManageInventory).toBe(true);
            expect(r.canCreateInventoryItems).toBe(true);
            expect(r.canViewPrices).toBe(true);
            expect(r.canEditInventoryItems).toBe(false);
            expect(r.canMergeInventoryItems).toBe(false);
        });

        it('permiso total permite editar y fusionar', () => {
            setInventoryPermission(technician.id, 'total');
            const r = run(technician);
            expect(r.canManageInventory).toBe(true);
            expect(r.canEditInventoryItems).toBe(true);
            expect(r.canMergeInventoryItems).toBe(true);
            expect(r.canCreateInventoryItems).toBe(true);
        });

        it('los permisos de otros usuarios no aplican', () => {
            setInventoryPermission(manager.id, 'total');
            expect(run(technician).canManageInventory).toBe(false);
        });
    });

    describe('permisos de órdenes de trabajo', () => {
        it('Observadores no pueden crear OTs', () => {
            expect(run(observerN1).canCreateWorkOrder).toBe(false);
            expect(run(observerN2).canCreateWorkOrder).toBe(false);
        });

        it('Roles operativos sí pueden', () => {
            expect(run(admin).canCreateWorkOrder).toBe(true);
            expect(run(manager).canCreateWorkOrder).toBe(true);
            expect(run(technician).canCreateWorkOrder).toBe(true);
        });

        it('solo Admin puede eliminar OTs', () => {
            expect(run(admin).canDeleteWorkOrder).toBe(true);
            expect(run(manager).canDeleteWorkOrder).toBe(false);
        });
    });

    describe('permisos del módulo Programador', () => {
        it('solo Admin y Responsable ven el grid del programador', () => {
            expect(run(admin).canViewSchedulerGrid).toBe(true);
            expect(run(manager).canViewSchedulerGrid).toBe(true);
            expect(run(technician).canViewSchedulerGrid).toBe(false);
        });

        it('Técnico solo ve sus propios partes de trabajo', () => {
            expect(run(technician).canViewOwnWorkLogs).toBe(true);
            expect(run(admin).canViewOwnWorkLogs).toBe(false);
        });

        it('Admin y Responsable ven los partes de todos', () => {
            expect(run(admin).canViewSectionWorkLogs).toBe(true);
            expect(run(manager).canViewSectionWorkLogs).toBe(true);
            expect(run(technician).canViewSectionWorkLogs).toBe(false);
        });
    });

    describe('acceso por sección', () => {
        it('Admin accede a cualquier sección', () => {
            expect(run(admin).canAccessSection('Cualquiera')).toBe(true);
        });

        it('Observador accede a cualquier sección', () => {
            expect(run(observerN1).canAccessSection('Planta')).toBe(true);
        });

        it('técnico accede solo a sus secciones', () => {
            const r = run(technician);
            expect(r.canAccessSection('Planta')).toBe(true);
            expect(r.canAccessSection('Almacén')).toBe(true);
            expect(r.canAccessSection('Sala')).toBe(false);
        });

        it('sección undefined siempre permite acceso', () => {
            expect(run(technician).canAccessSection(undefined)).toBe(true);
        });
    });
});
