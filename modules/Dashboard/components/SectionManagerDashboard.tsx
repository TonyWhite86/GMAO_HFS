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
                    <h1 className="text-2xl font-bold text-txt">Panel de {currentUser.sections[0] || 'Sección'}</h1>
                    <p className="text-txt-2">Resumen de operaciones y mantenimiento.</p>
                </div>
                <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { status: [WOStatus.PENDING] })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-warn-dim p-2 rounded-lg text-warn">
                            <Clock size={20} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-txt mb-1">{pendingWOs.length}</h3>
                    <p className="text-sm text-txt-2">Pendientes</p>
                </div>

                <div className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { unassigned: true })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-warn-dim p-2 rounded-lg text-warn">
                            <Users size={20} />
                        </div>
                        {unassignedWOs.length > 0 && <span className="text-xs font-bold bg-warn-dim text-warn px-2 py-0.5 rounded-full">Acción Req.</span>}
                    </div>
                    <h3 className="text-2xl font-bold text-txt mb-1">{unassignedWOs.length}</h3>
                    <p className="text-sm text-txt-2">Sin Asignar</p>
                </div>

                <div className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { status: [WOStatus.SCHEDULED] })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-spec-dim p-2 rounded-lg text-spec">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-txt mb-1">{scheduledWOs.length}</h3>
                    <p className="text-sm text-txt-2">Programadas</p>
                </div>

                <div className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow" onClick={() => onNavigateWithFilter('maintenance', { priority: [WOPriority.CRITICAL, WOPriority.HIGH], status: [WOStatus.PENDING, WOStatus.IN_PROGRESS, WOStatus.SCHEDULED] })}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="bg-ko-dim p-2 rounded-lg text-ko">
                            <AlertTriangle size={20} />
                        </div>
                        {criticalWOs.length > 0 && <span className="text-xs font-bold bg-ko-dim text-ko px-2 py-0.5 rounded-full">Prioritario</span>}
                    </div>
                    <h3 className="text-2xl font-bold text-txt mb-1">{criticalWOs.length}</h3>
                    <p className="text-sm text-txt-2">Críticas / Altas</p>
                </div>
            </div>

            <h2 className="text-lg font-bold text-txt mt-8 mb-4">Acciones Rápidas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <button onClick={onCreateWorkOrder} className="btn btn-primary text-white p-4 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Plus size={24} />
                    </div>
                    <span className="font-medium">Nueva Orden</span>
                </button>
                <button onClick={() => onNavigate('scheduler')} className="bg-surface text-txt-2 border border-line p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="bg-spec-dim text-spec p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Calendar size={24} />
                    </div>
                    <span className="font-medium">Programador</span>
                </button>
                <button onClick={onRequestPurchase} className="text-white p-4 rounded-xl shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group hover:brightness-110" style={{ background: 'var(--amber)' }}>
                    <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                        <ShoppingCart size={24} />
                    </div>
                    <span className="font-bold text-sm">Solicitud Material</span>
                </button>
                <button onClick={onRequestWithdrawal} className="bg-surface text-txt-2 border border-line p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="bg-ok-dim text-ok p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Package size={24} />
                    </div>
                    <span className="font-medium">Sacar Repuesto</span>
                </button>
            </div>
        </div>
    );
};
