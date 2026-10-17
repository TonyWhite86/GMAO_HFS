import React, { useMemo } from 'react';
import { Clock, Users, AlertCircle, Package, ArrowRight, BarChart3, CheckCircle, Plus, AlertTriangle, CalendarClock, QrCode, ShoppingCart, FileText } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { WOStatus, WOPriority } from '../../../types';
import { getStatusColor, PRIORITY_CONFIG } from '../../../constants';
import { computeWoWeeklyTrend, computeHoursDailyTrend } from '../../../utils/dashboardStats';
import { KpiCard } from '../widgets/KpiCard';
import { Sparkline } from '../widgets/Sparkline';
import { QuickActions, QuickAction } from '../widgets/QuickActions';
import { IncidentsPanel } from '../widgets/IncidentsPanel';
import { StoppagesPanel } from '../widgets/StoppagesPanel';
import { PreventivePanel } from '../widgets/PreventivePanel';
import { ExternalWOsPanel } from '../widgets/ExternalWOsPanel';
import { ActivityFeed } from '../widgets/ActivityFeed';
import { QualityKpis } from '../widgets/QualityKpis';

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
    const equipment = useAppStore(s => s.equipment);

    const activeWOs = workOrders.filter(wo => wo.status === WOStatus.IN_PROGRESS || wo.status === WOStatus.PENDING);
    const unassignedWOs = workOrders.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED);
    const criticalWOs = workOrders.filter(wo => (wo.priority === WOPriority.CRITICAL || wo.priority === WOPriority.HIGH) && wo.status !== WOStatus.COMPLETED);
    const lowStockItems = inventory.filter(item => item.status === 'Active' && item.quantity <= item.minStock);

    const sortedSections = useMemo(() => {
        const stats = workOrders.reduce((acc: Record<string, number>, wo) => {
            if (wo.status === WOStatus.COMPLETED) return acc;
            acc[wo.section] = (acc[wo.section] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [workOrders]);

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Órdenes Activas" value={activeWOs.length} icon={Clock} color="blue" onClick={() => onNavigate('maintenance')} />
                <KpiCard title="Sin Asignar" value={unassignedWOs.length} icon={Users} color="amber" onClick={() => onNavigate('scheduler')} />
                <KpiCard title="Críticas / Altas" value={criticalWOs.length} icon={AlertCircle} color="red" onClick={() => onNavigate('maintenance')} />
                <KpiCard title="Stock Bajo" value={lowStockItems.length} icon={Package} color="purple" onClick={() => onNavigate('inventory')} />
            </div>

            {/* Tendencias (B1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface rounded-2xl border border-line shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-txt-3 uppercase tracking-wider">OTs por semana</span>
                        <span className="flex items-center gap-2 text-[10px] text-txt-3">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--accent)' }} /> creadas</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--green)' }} /> completadas</span>
                        </span>
                    </div>
                    <div className="flex items-end gap-3">
                        <Sparkline data={weekTrend.map(w => w.created)} data2={weekTrend.map(w => w.completed)} color="var(--accent)" />
                        <div className="text-xs text-txt-2">
                            <span className="font-bold text-txt">{weekTrend.reduce((a, w) => a + w.created, 0)}</span> creadas /
                            <span className="font-bold text-txt"> {weekTrend.reduce((a, w) => a + w.completed, 0)}</span> completadas
                            <span className="block text-[10px] text-txt-3">últimas {weekTrend.length} semanas</span>
                        </div>
                    </div>
                </div>
                <div className="bg-surface rounded-2xl border border-line shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-txt-3 uppercase tracking-wider">Horas trabajadas por día</span>
                        <BarChart3 size={14} className="text-txt-3" />
                    </div>
                    <div className="flex items-end gap-3">
                        <Sparkline data={hoursTrend} color="var(--green)" />
                        <div className="text-xs text-txt-2">
                            <span className="font-bold text-txt">{hoursTrend.reduce((a, h) => a + h, 0).toFixed(1)}h</span>
                            <span className="block text-[10px] text-txt-3">últimos 7 días</span>
                        </div>
                    </div>
                </div>
            </div>

            <QuickActions actions={actions} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-txt text-lg">Órdenes Recientes</h3>
                            <button onClick={() => onNavigate('maintenance')} className="text-sm text-accent hover:underline flex items-center gap-1">
                                Ver todas <ArrowRight size={14} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {workOrders.slice(0, 5).map(wo => (
                                <div key={wo.id} className="flex items-center justify-between p-3 hover:bg-surface-2 rounded-lg transition-colors border border-transparent hover:border-line">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-current opacity-90 ${PRIORITY_CONFIG[wo.priority]?.bgClass}`}>
                                            {React.createElement(PRIORITY_CONFIG[wo.priority]?.icon || Clock, { size: 14 })}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-txt">{wo.title}</h4>
                                            <p className="text-xs text-txt-2">
                                                {equipment.find(e => e.id === wo.equipmentId)?.name || 'Equipo no especificado'} • {new Date(wo.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(wo.status)}`}>
                                            {wo.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {workOrders.length === 0 && (
                                <div className="text-center text-txt-3 py-4">No hay actividad reciente.</div>
                            )}
                        </div>
                    </div>

                    <IncidentsPanel onNavigate={() => onNavigate('incidents')} />
                    <StoppagesPanel onNavigate={() => onNavigate('stoppages')} />
                </div>

                <div className="space-y-6">
                    <QualityKpis onNavigateReports={() => onNavigate('reports')} />
                    <PreventivePanel onNavigate={() => onNavigate('maintenance')} />
                    <ExternalWOsPanel onNavigate={() => onNavigate('maintenance')} />

                    <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                        <h3 className="font-bold text-txt text-lg mb-4 flex items-center gap-2">
                            <BarChart3 size={20} className="text-txt-3" />
                            Carga por Sección
                        </h3>
                        <div className="space-y-4">
                            {sortedSections.length > 0 ? sortedSections.map(([section, count], _, arr) => {
                                const maxCount = arr.length > 0 ? arr[0][1] : 1;
                                return (
                                    <div key={section}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-txt-2">{section}</span>
                                            <span className="font-bold text-txt">{count}</span>
                                        </div>
                                        <div className="w-full bg-surface-2 rounded-full h-2">
                                            <div className="bg-accent h-2 rounded-full" style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center text-txt-3 text-sm">Sin datos suficientes.</div>
                            )}
                        </div>
                    </div>

                    <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                        <h3 className="font-bold text-txt text-lg mb-4 flex items-center gap-2">
                            <AlertTriangle size={20} className="text-warn" />
                            Alertas de Stock
                        </h3>
                        <div className="space-y-3">
                            {lowStockItems.slice(0, 3).map(item => (
                                <div key={item.id} className="flex justify-between items-center text-sm border-b border-line pb-2 last:border-0 last:pb-0">
                                    <span className="text-txt-2 truncate pr-2">{item.name}</span>
                                    <span className="font-bold text-ko whitespace-nowrap">{item.quantity} un.</span>
                                </div>
                            ))}
                            {lowStockItems.length === 0 && (
                                <div className="flex items-center gap-2 text-ok text-sm bg-ok-dim p-2 rounded">
                                    <CheckCircle size={16} /> Todo en orden
                                </div>
                            )}
                            {lowStockItems.length > 3 && (
                                <button onClick={() => onNavigate('inventory')} className="text-xs text-accent hover:underline pt-2 w-full text-center">
                                    Ver {lowStockItems.length - 3} más
                                </button>
                            )}
                        </div>
                    </div>

                    <ActivityFeed
                        onNavigateWo={() => onNavigate('maintenance')}
                        onNavigateIncident={() => onNavigate('incidents')}
                    />
                </div>
            </div>
        </div>
    );
};
