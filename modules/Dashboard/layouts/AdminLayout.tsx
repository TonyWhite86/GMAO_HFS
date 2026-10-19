import React, { useMemo } from 'react';
import { Clock, Users, AlertCircle, Package, Plus, CalendarClock, QrCode, ShoppingCart, TrendingUp, History, BarChart3 } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { WOStatus, WOPriority } from '../../../types';
import { computeWoWeeklyTrend, computeHoursDailyTrend } from '../../../utils/dashboardStats';
import { KpiCard } from '../widgets/KpiCard';
import { Sparkline } from '../widgets/Sparkline';
import { QuickActions, QuickAction } from '../widgets/QuickActions';
import { ActivityFeed } from '../widgets/ActivityFeed';
import { AlertsSummary } from '../widgets/AlertsSummary';

interface AdminLayoutProps {
    onNavigate: (module: string) => void;
    onCreateWorkOrder: () => void;
    onCreateIncident: () => void;
    onCreateStoppage: () => void;
    onRequestWithdrawal: () => void;
    onRequestPurchase: () => void;
    onScanQR: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
    onNavigate, onCreateWorkOrder, onCreateIncident, onCreateStoppage,
    onRequestWithdrawal, onRequestPurchase, onScanQR
}) => {
    const workOrders = useAppStore(s => s.workOrders);
    const inventory = useAppStore(s => s.inventory);

    const activeWOs = workOrders.filter(wo => wo.status === WOStatus.IN_PROGRESS || wo.status === WOStatus.PENDING);
    const unassignedWOs = workOrders.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED);
    const criticalWOs = workOrders.filter(wo => (wo.priority === WOPriority.CRITICAL || wo.priority === WOPriority.HIGH) && wo.status !== WOStatus.COMPLETED);
    const lowStockItems = inventory.filter(item => item.status === 'Active' && item.quantity <= item.minStock);

    const weekTrend = useMemo(() => computeWoWeeklyTrend(workOrders), [workOrders]);
    const hoursTrend = useMemo(() => computeHoursDailyTrend(workOrders), [workOrders]);

    const actions: QuickAction[] = [
        { label: 'Nueva Orden', icon: Plus, onClick: onCreateWorkOrder, tone: 'primary' },
        { label: 'Nueva Incidencia', icon: AlertCircle, onClick: onCreateIncident, tone: 'amber' },
        { label: 'Nueva Parada', icon: CalendarClock, onClick: onCreateStoppage },
        { label: 'Solicitud Material', icon: ShoppingCart, onClick: onRequestPurchase },
        { label: 'Escanear QR', icon: QrCode, onClick: onScanQR }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-txt">Panel de Control</h1>
                    <p className="text-txt-2">Resumen global de mantenimiento.</p>
                </div>
                <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* 1. KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Órdenes Activas" value={activeWOs.length} icon={Clock} color="blue" onClick={() => onNavigate('maintenance')} />
                <KpiCard title="Sin Asignar" value={unassignedWOs.length} icon={Users} color="amber" onClick={() => onNavigate('scheduler')} />
                <KpiCard title="Críticas / Altas" value={criticalWOs.length} icon={AlertCircle} color="red" onClick={() => onNavigate('maintenance')} />
                <KpiCard title="Stock Bajo" value={lowStockItems.length} icon={Package} color="purple" onClick={() => onNavigate('inventory')} />
            </div>

            {/* 2. Acciones rápidas */}
            <QuickActions actions={actions} />

            {/* 3. Tendencias (una sola tarjeta) + 4. Alertas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface rounded-2xl border border-line shadow-sm p-4">
                    <h3 className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider mb-3">
                        <TrendingUp size={14} />
                        Tendencias
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-txt-3 uppercase tracking-wider">OTs por semana</span>
                                <span className="flex items-center gap-2 text-[10px] text-txt-3">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} /> creadas</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--green)' }} /> completadas</span>
                                </span>
                            </div>
                            <div className="flex items-end gap-3">
                                <Sparkline data={weekTrend.map(w => w.created)} data2={weekTrend.map(w => w.completed)} color="var(--accent)" />
                                <div className="text-xs text-txt-2">
                                    <span className="font-bold text-txt">{weekTrend.reduce((a, w) => a + w.created, 0)}</span> /
                                    <span className="font-bold text-txt"> {weekTrend.reduce((a, w) => a + w.completed, 0)}</span>
                                    <span className="block text-[10px] text-txt-3">últimas {weekTrend.length} semanas</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-txt-3 uppercase tracking-wider">Horas por día</span>
                                <span className="flex items-center gap-1 text-[10px] text-txt-3"><BarChart3 size={11} /> 7 días</span>
                            </div>
                            <div className="flex items-end gap-3">
                                <Sparkline data={hoursTrend} color="var(--green)" />
                                <div className="text-xs text-txt-2">
                                    <span className="font-bold text-txt">{hoursTrend.reduce((a, h) => a + h, 0).toFixed(1)}h</span>
                                    <span className="block text-[10px] text-txt-3">esta semana</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <AlertsSummary
                    onNavigateIncidents={() => onNavigate('incidents')}
                    onNavigateStoppages={() => onNavigate('stoppages')}
                    onNavigateInventory={() => onNavigate('inventory')}
                    onNavigateMaintenance={() => onNavigate('maintenance')}
                />
            </div>

            {/* 5. Actividad reciente */}
            <ActivityFeed
                onNavigateWo={() => onNavigate('maintenance')}
                onNavigateIncident={() => onNavigate('incidents')}
            />
        </div>
    );
};
