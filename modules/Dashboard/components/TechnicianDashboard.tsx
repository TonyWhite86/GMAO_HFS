import React, { useState } from 'react';
import { Package, Wrench, Calendar, CheckCircle } from 'lucide-react';
import { WorkOrder, WOStatus, UserRole, User, Equipment } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { WorkOrderCard } from '../../../components/workOrder/WorkOrderCard';
import { QuickStatusModal } from '../../../components/workOrder/QuickStatusModal';
import { QuickCompleteModal } from '../../../components/workOrder/QuickCompleteModal';

interface TechnicianDashboardProps {
    onRequestWithdrawal: () => void;
    onSelectWorkOrder: (id: string) => void;
}

export const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ onRequestWithdrawal, onSelectWorkOrder }) => {
    const { currentUser, workOrders, equipment, users } = useAppStore();

    const [completingWO, setCompletingWO] = useState<WorkOrder | null>(null);
    const [statusActionWO, setStatusActionWO] = useState<{ wo: WorkOrder; nextStatus: WOStatus } | null>(null);

    const todayStr = new Date().toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const myAssignedWOs = workOrders.filter(wo => {
        if (wo.assignedUserId !== currentUser?.id || wo.status === WOStatus.COMPLETED) return false;
        const scheduledIso = wo.scheduledDate || wo.createdAt;
        const scheduledYMD = scheduledIso.split('T')[0];
        return scheduledYMD <= todayStr;
    });

    const myTomorrowWOs = workOrders.filter(wo => {
        if (wo.assignedUserId !== currentUser?.id || wo.status === WOStatus.COMPLETED) return false;
        const scheduledIso = wo.scheduledDate || wo.createdAt;
        const scheduledYMD = scheduledIso.split('T')[0];
        return scheduledYMD === tomorrowStr;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Hola, {currentUser?.name.split(' ')[0]}</h1>
                    <p className="text-slate-500 dark:text-slate-400">Tienes <span className="font-bold text-slate-800 dark:text-white">{myAssignedWOs.length}</span> trabajos pendientes para hoy.</p>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <button onClick={onRequestWithdrawal} className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group">
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-lg group-hover:scale-110 transition-transform">
                        <Package size={24} />
                    </div>
                    <span className="font-medium text-sm">Retirar Material</span>
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2 px-1">
                        <Wrench size={20} className="text-blue-500" />
                        Trabajos Prioritarios para Hoy
                    </h3>
                    <div>
                        {myAssignedWOs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                                {myAssignedWOs.map(wo => (
                                    <WorkOrderCard
                                        key={wo.id}
                                        wo={wo}
                                        equipment={equipment}
                                        users={users}
                                        onClick={() => onSelectWorkOrder(wo.id)}
                                        onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                                        onComplete={(wo) => setCompletingWO(wo)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                                <CheckCircle size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
                                <p className="text-lg font-medium">¡Todo al día!</p>
                                <p>No tienes tareas asignadas retrasadas o para realizar hoy.</p>
                            </div>
                        )}
                    </div>
                </div>

                {myTomorrowWOs.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2 px-1 opacity-75">
                            <Calendar size={20} className="text-purple-500" />
                            Trabajos para Mañana
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                            {myTomorrowWOs.map(wo => (
                                <WorkOrderCard
                                    key={wo.id}
                                    wo={wo}
                                    equipment={equipment}
                                    users={users}
                                    onClick={() => onSelectWorkOrder(wo.id)}
                                    onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                                    onComplete={(wo) => setCompletingWO(wo)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {statusActionWO && (
                <QuickStatusModal
                    workOrder={statusActionWO.wo}
                    nextStatus={statusActionWO.nextStatus}
                    onClose={() => setStatusActionWO(null)}
                    onConfirm={() => {
                        // El cambio de estado ya lo hizo transition_work_order (RPC).
                        setStatusActionWO(null);
                    }}
                    currentUser={currentUser}
                />
            )}

            {completingWO && (
                <QuickCompleteModal
                    workOrder={completingWO}
                    onClose={() => setCompletingWO(null)}
                    onConfirm={(updated) => {
                        useAppStore.getState().updateWorkOrder(updated);
                        setCompletingWO(null);
                    }}
                    inventory={[]}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};
