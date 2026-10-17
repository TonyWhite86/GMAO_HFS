import React, { useState } from 'react';
import { Package, CheckCircle, Wrench, Calendar, Plus, AlertCircle, QrCode } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { WorkOrderCard } from '../../../components/workOrder/WorkOrderCard';
import { QuickCompleteModal } from '../../../components/workOrder/QuickCompleteModal';
import { QuickStatusModal } from '../../../components/workOrder/QuickStatusModal';
import { WorkOrderDetailModal } from '../../../components/WorkOrderDetailModal';
import { WorkOrder, WOStatus } from '../../../types';
import { getMyTodayWOs, getMyTomorrowWOs } from '../../../utils/dashboardStats';
import { QuickActions, QuickAction } from '../widgets/QuickActions';
import { IncidentsPanel } from '../widgets/IncidentsPanel';
import { StoppagesPanel } from '../widgets/StoppagesPanel';
import { ActivityFeed } from '../widgets/ActivityFeed';

interface TechnicianLayoutProps {
    onNavigate: (module: string) => void;
    onRequestWithdrawal: () => void;
    onCreateIncident: () => void;
    onScanQR: () => void;
}

export const TechnicianLayout: React.FC<TechnicianLayoutProps> = ({
    onNavigate, onRequestWithdrawal, onCreateIncident, onScanQR
}) => {
    const {
        workOrders, equipment, users, inventory, sections, preventivePlans, currentUser,
        updateWorkOrder, addWorkOrder, updateInventory
    } = useAppStore();

    const [completingWO, setCompletingWO] = useState<WorkOrder | null>(null);
    const [statusActionWO, setStatusActionWO] = useState<{ wo: WorkOrder; nextStatus: WOStatus } | null>(null);
    const [detailWO, setDetailWO] = useState<WorkOrder | null>(null);

    const myToday = currentUser ? getMyTodayWOs(workOrders, currentUser.id) : [];
    const myTomorrow = currentUser ? getMyTomorrowWOs(workOrders, currentUser.id) : [];

    const actions: QuickAction[] = [
        { label: 'Retirar Material', icon: Package, onClick: onRequestWithdrawal },
        { label: 'Nueva Incidencia', icon: AlertCircle, onClick: onCreateIncident, tone: 'amber' },
        { label: 'Escanear QR', icon: QrCode, onClick: onScanQR }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-txt">Hola, {currentUser?.name.split(' ')[0]}</h1>
                    <p className="text-txt-2">Tienes <span className="font-bold text-txt">{myToday.length}</span> trabajos pendientes para hoy.</p>
                </div>
                <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <QuickActions actions={actions} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-4">
                        <h3 className="font-bold text-txt text-lg flex items-center gap-2 px-1">
                            <Wrench size={20} className="text-accent" />
                            Trabajos Prioritarios para Hoy
                        </h3>
                        {myToday.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                                {myToday.map(wo => (
                                    <WorkOrderCard
                                        key={wo.id}
                                        wo={wo}
                                        equipment={equipment}
                                        users={users}
                                        onClick={() => setDetailWO(wo)}
                                        onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                                        onComplete={(wo) => setCompletingWO(wo)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-surface rounded-xl shadow-sm border border-line p-8 text-center text-txt-2">
                                <CheckCircle size={48} className="mx-auto mb-4 text-ok opacity-50" />
                                <p className="text-lg font-medium">¡Todo al día!</p>
                                <p>No tienes tareas asignadas retrasadas o para realizar hoy.</p>
                            </div>
                        )}
                    </div>

                    {myTomorrow.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="font-bold text-txt text-lg flex items-center gap-2 px-1 opacity-75">
                                <Calendar size={20} className="text-spec" />
                                Trabajos para Mañana
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                                {myTomorrow.map(wo => (
                                    <WorkOrderCard
                                        key={wo.id}
                                        wo={wo}
                                        equipment={equipment}
                                        users={users}
                                        onClick={() => setDetailWO(wo)}
                                        onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                                        onComplete={(wo) => setCompletingWO(wo)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <IncidentsPanel onNavigate={() => onNavigate('incidents')} />
                    <StoppagesPanel onNavigate={() => onNavigate('stoppages')} />
                    <ActivityFeed
                        onNavigateWo={() => onNavigate('maintenance')}
                        onNavigateIncident={() => onNavigate('incidents')}
                    />
                </div>
            </div>

            {statusActionWO && (
                <QuickStatusModal
                    workOrder={statusActionWO.wo}
                    nextStatus={statusActionWO.nextStatus}
                    onClose={() => setStatusActionWO(null)}
                    onConfirm={() => setStatusActionWO(null)}
                    currentUser={currentUser!}
                />
            )}

            {detailWO && (
                <WorkOrderDetailModal
                    workOrder={detailWO}
                    onClose={() => setDetailWO(null)}
                    onUpdate={(updated, shouldClose) => {
                        updateWorkOrder(updated);
                        if (shouldClose !== false) setDetailWO(null);
                    }}
                    onAddWorkOrder={addWorkOrder}
                    preventivePlans={preventivePlans}
                    currentUser={currentUser!}
                    users={users}
                    equipment={equipment}
                    existingWorkOrders={workOrders}
                    sections={sections}
                    inventory={inventory}
                    onUpdateInventory={updateInventory}
                />
            )}

            {completingWO && (
                <QuickCompleteModal
                    workOrder={completingWO}
                    onClose={() => setCompletingWO(null)}
                    onConfirm={(updated) => {
                        updateWorkOrder(updated);
                        setCompletingWO(null);
                    }}
                    inventory={inventory}
                    currentUser={currentUser!}
                />
            )}
        </div>
    );
};
