import { useMemo } from 'react';
import { User, UserRole, PermissionLevel } from '../types';
import { useAppStore } from '../store/useAppStore';

export const usePermissions = (currentUser: User | null) => {
    const userPermissions = useAppStore(s => s.userPermissions);

    const userId = currentUser?.id;
    const role = currentUser?.role;

    const isAdmin = role === UserRole.ADMIN;
    const isSectionManager = role === UserRole.SECTION_MANAGER;
    const isTechnician = role === UserRole.TECHNICIAN;
    const isObserver = role === UserRole.OBSERVER_L1 || role === UserRole.OBSERVER_L2;

    const inventoryPermission: PermissionLevel = useMemo(() => {
        if (isAdmin) return 'total';
        if (!userId) return 'sin_acceso';
        const perm = userPermissions.find(p => p.userId === userId && p.module === 'inventory');
        return perm?.level ?? 'sin_acceso';
    }, [userPermissions, userId, isAdmin]);

    // Actuaciones: por defecto acceso total (compatibilidad); el permiso restringe
    const actuacionesPermission: PermissionLevel = useMemo(() => {
        if (isAdmin) return 'total';
        if (!userId || isObserver) return 'sin_acceso';
        const perm = userPermissions.find(p => p.userId === userId && p.module === 'actuaciones');
        return perm?.level ?? 'total';
    }, [userPermissions, userId, isAdmin, isObserver]);

    // Paradas: por defecto consulta (todos ven el calendario). La GESTIÓN ya
    // no sale de 'paradas' = 'total': es Admin, o el creador de cada parada
    // (ver utils/stoppagePermissions.ts).
    const paradasPermission: PermissionLevel = useMemo(() => {
        if (isAdmin) return 'total';
        if (!userId || isObserver) return 'sin_acceso';
        const perm = userPermissions.find(p => p.userId === userId && p.module === 'paradas');
        return perm?.level ?? 'consulta';
    }, [userPermissions, userId, isAdmin, isObserver]);

    const canViewActuaciones = actuacionesPermission !== 'sin_acceso';
    const canCreateActuaciones = actuacionesPermission === 'total';
    const canViewStoppages = paradasPermission !== 'sin_acceso';
    // Crear desde el calendario o gestionar paradas ajenas: sólo Admin.
    const canCreateStoppages = isAdmin;
    const canManageStoppages = isAdmin;

    const canManageUsers = isAdmin;
    const canManageSections = isAdmin;
    const canManagePreventivePlans = isAdmin || isSectionManager;

    const canManageInventory = inventoryPermission === 'parcial' || inventoryPermission === 'total';
    const canViewPrices = inventoryPermission === 'parcial' || inventoryPermission === 'total';
    const canEditInventoryItems = inventoryPermission === 'total';
    const canMergeInventoryItems = inventoryPermission === 'total';
    const canCreateInventoryItems = inventoryPermission === 'parcial' || inventoryPermission === 'total';
    const canViewAllEquipment = inventoryPermission === 'parcial' || inventoryPermission === 'total';
    const canRegisterMovements = inventoryPermission === 'parcial' || inventoryPermission === 'total';
    const canManagePurchaseOrders = inventoryPermission === 'parcial' || inventoryPermission === 'total';

    const canCreateWorkOrder = !isObserver;
    const canDeleteWorkOrder = isAdmin;
    const canManageEquipment = isAdmin;

    const canViewSchedulerGrid = isAdmin || isSectionManager;
    const canViewOwnWorkLogs = isTechnician;
    const canViewSectionWorkLogs = isAdmin || isSectionManager;

    const canAccessSection = (sectionName: string | undefined) => {
        if (!sectionName) return true;
        if (isAdmin || isObserver) return true;
        return currentUser?.sections?.includes(sectionName) || false;
    };

    return {
        role: currentUser?.role,
        isAdmin,
        isSectionManager,
        isTechnician,
        isObserver,

        inventoryPermission,
        actuacionesPermission,
        paradasPermission,
        canViewActuaciones,
        canCreateActuaciones,
        canViewStoppages,
        canCreateStoppages,
        canManageStoppages,
        canManageUsers,
        canManageSections,
        canManagePreventivePlans,
        canManageInventory,
        canViewPrices,
        canEditInventoryItems,
        canMergeInventoryItems,
        canCreateInventoryItems,
        canViewAllEquipment,
        canRegisterMovements,
        canManagePurchaseOrders,
        canManageEquipment,
        canCreateWorkOrder,
        canDeleteWorkOrder,
        canAccessSection,
        canViewSchedulerGrid,
        canViewOwnWorkLogs,
        canViewSectionWorkLogs,
    };
};
