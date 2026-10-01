import React from 'react';
import { Clock, Users, Calendar, AlertTriangle, Plus, Package, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { UserRole, WOStatus, WOPriority } from '../../../types';

interface SectionManagerDashboardProps {
    onNavigate: (module: string) => void;
    onNavigateWithFilter: (module: string, filters: { status?: WOStatus[]; unassigned?: boolean; priority?: WOPriority[]; section?: string[] }) => void;
    onCreateWorkOrder: () => void;
    onRequestPurchase: () => void;
    onRequestWithdrawal: () => void;
}

export const SectionManagerDashboard: React.FC<SectionManagerDashboardProps> = ({
    onNavigate, onNavigateWithFilter, onCreateWorkOrder, onRequestPurchase, onRequestWithdrawal
}) => {
    const { currentUser, workOrders } = useAppStore();

    if (!currentUser) return null;

    const mySectionWOs = workOrders.filter(wo => {
        const isCollaborator = (wo.collaboratingSections || []).some(s => currentUser.sections.includes(s));
        return currentUser.sections.includes(wo.section) || isCollaborator;
    });

    const pendingWOs = mySectionWOs.filter(wo => wo.status === WOStatus.PENDING);
    const unassignedWOs = mySectionWOs.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED);
    const scheduledWOs = mySectionWOs.filter(wo => wo.status === WOStatus.SCHEDULED);
    const criticalWOs = mySectionWOs.filter(wo => (wo.priority === WOPriority.CRITICAL || wo.priority === WOPriority.HIGH) && wo.status !== WOStatus.COMPLETED);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Panel de {currentUser.sections[0] || 'Sección'}</h1>
                    <p className="text-slate-500 dark:text-slate-400">Resumen de operaciones y mantenimiento.</p>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { status: [WOStatus.PENDING] })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg text-yellow-600 dark:text-yellow-400">
                            <Clock size={20} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{pendingWOs.length}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Pendientes</p>
                </div>

                <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { unassigned: true })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                            <Users size={20} />
                        </div>
                        {unassignedWOs.length > 0 && <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Acción Req.</span>}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{unassignedWOs.length}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Sin Asignar</p>
                </div>

                <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { status: [WOStatus.SCHEDULED] })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{scheduledWOs.length}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Programadas</p>
                </div>

                <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { priority: [WOPriority.CRITICAL, WOPriority.HIGH], status: [WOStatus.PENDING, WOStatus.IN_PROGRESS, WOStatus.SCHEDULED] })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600 dark:text-red-400">
                            <AlertTriangle size={20} />
                        </div>
                        {criticalWOs.length > 0 && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Prioritario</span>}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{criticalWOs.length}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Críticas / Altas</p>
                </div>
            </div>

            <h2 className="text-lg font-bold text-slate-800 dark:text-white mt-8 mb-4">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <button onClick={onCreateWorkOrder} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Plus size={24} />
                    </div>
                    <span className="font-medium">Nueva Orden</span>
                </button>
                <button onClick={() => onNavigate('scheduler')} className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Calendar size={24} />
                    </div>
                    <span className="font-medium">Programador</span>
                </button>
                <button onClick={onRequestPurchase} className="bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                        <ShoppingCart size={24} />
                    </div>
                    <span className="font-bold text-sm">Solicitud Material</span>
                </button>
                <button onClick={onRequestWithdrawal} className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Package size={24} />
                    </div>
                    <span className="font-medium">Sacar Repuesto</span>
                </button>
            </div>
        </div>
    );
};
