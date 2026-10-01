import React from 'react';
import { Clock, AlertTriangle, AlertCircle, Package, ArrowRight, BarChart3, Users, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { StatCard } from '../../../components/ui/StatCard';
import { getStatusColor } from '../../../constants';
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

const getPriorityStyles = (priority: WOPriority) => {
    switch (priority) {
        case WOPriority.CRITICAL:
            return 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 shadow-sm shadow-red-500/10';
        case WOPriority.HIGH:
            return 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 shadow-sm shadow-amber-500/10';
        case WOPriority.MEDIUM:
            return 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 shadow-sm shadow-blue-500/10';
        case WOPriority.LOW:
        default:
            return 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/20 dark:to-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm shadow-slate-500/5';
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
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Panel de Control</h1>
                    <p className="text-slate-500 dark:text-slate-400">Bienvenido de nuevo, {currentUser.name}</p>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
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
                <div className="lg:col-span-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Órdenes Recientes</h3>
                        <button onClick={() => onNavigate('maintenance')} className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                            Ver todas <ArrowRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {workOrders.slice(0, 5).map(wo => (
                            <div key={wo.id} className="flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-current opacity-90 ${getPriorityStyles(wo.priority)}`}>
                                        {getPriorityIcon(wo.priority)}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-800 dark:text-slate-200">{wo.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
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
                            <div className="text-center text-slate-400 py-4">No hay actividad reciente.</div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
                            <BarChart3 size={20} className="text-slate-400" />
                            Carga por Sección
                        </h3>
                        <div className="space-y-4">
                            {sortedSections.length > 0 ? sortedSections.map(([section, count], _, arr) => {
                                const maxCount = arr.length > 0 ? arr[0][1] : 1;
                                return (
                                    <div key={section}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-slate-600 dark:text-slate-300">{section}</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-100">{count}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${maxCount > 0 ? ((count as number) / maxCount) * 100 : 0}%` }}></div>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="text-center text-slate-400 text-sm">Sin datos suficientes.</div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
                            <AlertTriangle size={20} className="text-amber-500" />
                            Alertas de Stock
                        </h3>
                        <div className="space-y-3">
                            {lowStockItems.slice(0, 3).map(item => (
                                <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                                    <span className="text-slate-600 dark:text-slate-300 truncate pr-2">{item.name}</span>
                                    <span className="font-bold text-red-500 whitespace-nowrap">{item.quantity} un.</span>
                                </div>
                            ))}
                            {lowStockItems.length === 0 && (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/10 p-2 rounded">
                                    <CheckCircle size={16} /> Todo en orden
                                </div>
                            )}
                            {lowStockItems.length > 3 && (
                                <button onClick={() => onNavigate('inventory')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline pt-2 w-full text-center">
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
