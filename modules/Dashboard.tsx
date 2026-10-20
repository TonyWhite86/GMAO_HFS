import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { UserRole, WOStatus, WOPriority } from '../types';
import { TechnicianLayout } from './Dashboard/layouts/TechnicianLayout';
import { WarehouseLayout } from './Dashboard/layouts/WarehouseLayout';
import { ManagerLayout } from './Dashboard/layouts/ManagerLayout';
import { AdminLayout } from './Dashboard/layouts/AdminLayout';

export interface DashboardProps {
    onNavigate: (module: string) => void;
    onNavigateWithFilter: (module: string, filters: { status?: WOStatus[], unassigned?: boolean, priority?: WOPriority[], section?: string[] }) => void;
    onCreateWorkOrder: () => void;
    onCreateIncident: () => void;
    onCreateStoppage: () => void;
    onRequestWithdrawal: () => void;
    onRequestPurchase: () => void;
    onScanQR: () => void;
}

export const Dashboard: React.FC<DashboardProps> = (props) => {
    const currentUser = useAppStore(s => s.currentUser);
    if (!currentUser) return null;

    const isObserver = currentUser.role === UserRole.OBSERVER_L1 || currentUser.role === UserRole.OBSERVER_L2;
    const isInWarehouse = currentUser.sections.some(s =>
        s.toLowerCase().includes('almacen') ||
        s.toLowerCase().includes('almacén') ||
        s.toLowerCase().includes('logistica') ||
        s.toLowerCase().includes('logística')
    );

    if (currentUser.role === UserRole.TECHNICIAN) {
        return <TechnicianLayout {...props} />;
    }
    if (isInWarehouse) {
        return <WarehouseLayout {...props} />;
    }
    if (currentUser.role === UserRole.SECTION_MANAGER) {
        return <ManagerLayout {...props} />;
    }
    if (isObserver) {
        // Los observadores viven en Incidencias; App ya redirige, pero por si acaso.
        return <AdminLayout {...props} />;
    }
    return <AdminLayout {...props} />;
};
