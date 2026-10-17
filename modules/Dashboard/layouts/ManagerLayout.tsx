import React from 'react';
import { Clock, Users, Calendar, AlertTriangle, Plus, ShoppingCart, Package, QrCode, AlertCircle, CalendarClock } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { WOStatus, WOPriority } from '../../../types';
import { KpiCard } from '../widgets/KpiCard';
import { QuickActions, QuickAction } from '../widgets/QuickActions';
import { IncidentsPanel } from '../widgets/IncidentsPanel';
import { StoppagesPanel } from '../widgets/StoppagesPanel';
import { PreventivePanel } from '../widgets/PreventivePanel';
import { ExternalWOsPanel } from '../widgets/ExternalWOsPanel';
import { ActivityFeed } from '../widgets/ActivityFeed';

interface ManagerLayoutProps {
    onNavigate: (module: string) => void;
    onNavigateWithFilter: (module: string, filters: { status?: WOStatus[], unassigned?: boolean, priority?: WOPriority[], section?: string[] }) => void;
    onCreateWorkOrder: () => void;
    onCreateIncident: () => void;
    onCreateStoppage: () => void;
    onRequestWithdrawal: () => void;
    onRequestPurchase: () => void;
    onScanQR: () => void;
}

export const ManagerLayout: React.FC<ManagerLayoutProps> = ({
    onNavigate, onNavigateWithFilter, onCreateWorkOrder, onCreateIncident, onCreateStoppage,
    onRequestWithdrawal, onRequestPurchase, onScanQR
}) => {
    const workOrders = useAppStore(s => s.workOrders);
    const currentUser = useAppStore(s => s.currentUser);

    const mySectionWOs = workOrders.filter(wo => {
        const isCollaborator = (wo.collaboratingSections || []).some(s => currentUser?.sections.includes(s));
        return (currentUser?.sections || []).includes(wo.section) || isCollaborator;
    });

    const pendingWOs = mySectionWOs.filter(wo => wo.status === WOStatus.PENDING);
    const unassignedWOs = mySectionWOs.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED);
    const scheduledWOs = mySectionWOs.filter(wo => wo.status === WOStatus.SCHEDULED);
    const criticalWOs = mySectionWOs.filter(wo => (wo.priority === WOPriority.CRITICAL || wo.priority === WOPriority.HIGH) && wo.status !== WOStatus.COMPLETED);

    const actions: QuickAction[] = [
        { label: 'Nueva Orden', icon: Plus, onClick: onCreateWorkOrder, tone: 'primary' },
        { label: 'Nueva Incidencia', icon: AlertCircle, onClick: onCreateIncident, tone: 'amber' },
        { label: 'Nueva Parada', icon: CalendarClock, onClick: onCreateStoppage },
        { label: 'Solicitud Material', icon: ShoppingCart, onClick: onRequestPurchase },
        { label: 'Sacar Repuesto', icon: Package, onClick: onRequestWithdrawal }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-txt">Panel de {currentUser?.sections[0] || 'Sección'}</h1>
                    <p className="text-txt-2">Resumen de operaciones y mantenimiento.</p>
                </div>
                <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Pendientes" value={pendingWOs.length} icon={Clock} color="amber"
                    onClick={() => onNavigateWithFilter('maintenance', { status: [WOStatus.PENDING] })} />
                <KpiCard title="Sin Asignar" value={unassignedWOs.length} icon={Users} color="red"
                    onClick={() => onNavigateWithFilter('maintenance', { unassigned: true })} />
                <KpiCard title="Programadas" value={scheduledWOs.length} icon={Calendar} color="purple"
                    onClick={() => onNavigateWithFilter('maintenance', { status: [WOStatus.SCHEDULED] })} />
                <KpiCard title="Críticas / Altas" value={criticalWOs.length} icon={AlertTriangle} color="blue"
                    onClick={() => onNavigateWithFilter('maintenance', {
                        priority: [WOPriority.CRITICAL, WOPriority.HIGH],
                        status: [WOStatus.PENDING, WOStatus.IN_PROGRESS, WOStatus.SCHEDULED]
                    })} />
            </div>

            <QuickActions actions={actions} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <IncidentsPanel onNavigate={() => onNavigate('incidents')} />
                    <StoppagesPanel onNavigate={() => onNavigate('stoppages')} />
                </div>
                <div className="space-y-6">
                    <PreventivePanel onNavigate={() => onNavigate('maintenance')} />
                    <ExternalWOsPanel onNavigate={() => onNavigate('maintenance')} />
                    <ActivityFeed
                        onNavigateWo={() => onNavigate('maintenance')}
                        onNavigateIncident={() => onNavigate('incidents')}
                    />
                </div>
            </div>
        </div>
    );
};
