import React from 'react';
import { Clock, AlertTriangle, AlertCircle, Package, ArrowRight, BarChart3, Users, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { StatCard } from '../../../components/ui/StatCard';
import { getStatusColor, PRIORITY_CONFIG } from '../../../constants';
import { WOPriority, WOStatus } from '../../../types';

interface AdminDashboardProps {
    onNavigate: (module: string) => void;
    onSelectWorkOrder: (id: string) => void;
}

const getPriorityIcon = (priority: WOPriority) => {
    switch (priority) {
        case WOPriority.CRITICAL:
        case WOPriority.HIGH:
            return <AlertTriangle size={14} />;
        default:
            return <Clock size={14} />;
    }
};


export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onSelectWorkOrder }) => {
    const { workOrders, inventory, currentUser, equipment } = useAppStore();

    const activeWOs = workOrders.filter(wo => wo.status === WOStatus.IN_PROGRESS || wo.status === WOStatus.PENDING);
    const unassignedWOs = workOrders.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED);
    const criticalWOs = workOrders.filter(wo => (wo.priority === WOPriority.CRITICAL || wo.priority === WOPriority.HIGH) && wo.status !== WOStatus.COMPLETED);
    const lowStockItems = inventory.filter(item => item.quantity <= item.minStock);

    const sectionStats = workOrders.reduce((acc: Record<string, number>, wo) => {
        if (wo.status === WOStatus.COMPLETED) return acc;
        const currentCount = acc[wo.section] || 0;
        acc[wo.section] = currentCount + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedSections = Object.entries(sectionStats)
        .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
        .slice(0, 5);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-txt">Panel de Control</h1>
                    <p className="text-txt-2">Bienvenido de nuevo, {currentUser.name}</p>
                </div>
                <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Órdenes Activas" value={activeWOs.length} icon={Clock} color="blue" onClick={() => onNavigate('maintenance')} />
                <StatCard title="Sin Asignar" value={unassignedWOs.length} icon={Users} color="amber" onClick={() => onNavigate('scheduler')} />
                <StatCard title="Críticas / Altas" value={criticalWOs.length} icon={AlertCircle} color="red" onClick={() => onNavigate('maintenance')} />
                <StatCard title="Stock Bajo" value={lowStockItems.length} icon={Package} color="purple" onClick={() => onNavigate('inventory')} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-surface rounded-xl shadow-sm border border-line p-6">
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
                                        {getPriorityIcon(wo.priority)}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-txt text-txt-2">{wo.title}</h4>
                                        <p className="text-xs text-txt-2">
                                            {equipment.find(e => e.id === wo.equipmentId)?.name || 'Equipo no especificado'} • {new Date(wo.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(wo.status)}`}>{wo.status}</span>
                                </div>
                            </div>
                        ))}
                        {workOrders.length === 0 && (
                            <div className="text-center text-txt-3 py-4">No hay actividad reciente.</div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
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
                                            <div className="bg-accent h-2 rounded-full" style={{ width: `${maxCount > 0 ? ((count as number) / maxCount) * 100 : 0}%` }}></div>
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
                </div>
            </div>
        </div>
    );
};
