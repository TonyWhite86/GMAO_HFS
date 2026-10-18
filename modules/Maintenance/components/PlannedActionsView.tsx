import React, { useState } from 'react';
import { CalendarClock, PlayCircle, PauseCircle, CheckSquare, CalendarPlus, AlertTriangle, CheckCircle } from 'lucide-react';
import { WorkOrder, WOStatus, User, Equipment, EquipmentStoppage } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { usePermissions } from '../../../hooks/usePermissions';
import { StoppageFormModal } from '../../Stoppages/components/StoppageFormModal';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { CollaboratorsCell } from './CollaboratorsCell';
import { groupByTimeframe, getDueLabel, getDueTone } from '../../../utils/maintenanceStats';
import { canManageStoppage, canDeleteStoppage } from '../../../utils/stoppagePermissions';

interface PlannedActionsViewProps {
    workOrders: WorkOrder[];
    users: User[];
    equipment: Equipment[];
    onSelectWO: (id: string) => void;
    onStatusAction: (wo: WorkOrder, nextStatus: WOStatus) => void;
    onComplete: (wo: WorkOrder) => void;
}

const GROUP_LABELS: { key: 'hoy' | 'manana' | 'estaSemana' | 'proximas'; label: string }[] = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'manana', label: 'Mañana' },
    { key: 'estaSemana', label: 'Esta semana' },
    { key: 'proximas', label: 'Próximas' }
];

export const PlannedActionsView: React.FC<PlannedActionsViewProps> = ({
    workOrders, users, equipment, onSelectWO, onStatusAction, onComplete
}) => {
    const { currentUser, addStoppage, updateStoppage, deleteStoppage } = useAppStore();
    const { canCreateStoppages } = usePermissions(currentUser);
    const [stoppageWO, setStoppageWO] = useState<WorkOrder | null>(null);

    const groups = groupByTimeframe(workOrders);

    const row = (wo: WorkOrder) => {
        const date = new Date(wo.scheduledDate || wo.createdAt);
        const due = getDueLabel(wo);
        const tone = getDueTone(wo);
        const eq = equipment.find(e => e.id === wo.equipmentId);
        return (
            <div
                key={wo.id}
                onClick={() => onSelectWO(wo.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-line bg-surface hover:bg-surface-2 hover:border-line-2 transition-colors cursor-pointer"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-txt text-sm truncate">{wo.title}</span>
                        {due === 'Vencida' && (
                            <span className="bdg bdg-red shrink-0">
                                <AlertTriangle size={10} /> Vencida
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-txt-2 mt-0.5 flex-wrap">
                        <span className="truncate">{eq?.name || 'Equipo no especificado'}</span>
                        <CollaboratorsCell wo={wo} users={users} />
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${tone === 'ko' ? 'text-ko' : tone === 'warn' ? 'text-warn' : 'text-txt'}`}>
                        {date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} · {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                        <StatusBadge status={wo.status} type="workOrder" />
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {canCreateStoppages && (
                        <button
                            onClick={() => setStoppageWO(wo)}
                            className="p-1.5 text-txt-3 hover:text-warn hover:bg-warn-dim rounded-md transition-colors"
                            title="Programar parada de equipo asociada"
                        >
                            <CalendarPlus size={16} />
                        </button>
                    )}
                    {wo.status === WOStatus.PENDING && (
                        <button
                            onClick={() => onStatusAction(wo, WOStatus.IN_PROGRESS)}
                            className="p-1.5 text-txt-3 hover:text-ok hover:bg-ok-dim rounded-md transition-colors"
                            title="Iniciar"
                        >
                            <PlayCircle size={16} />
                        </button>
                    )}
                    {wo.status === WOStatus.IN_PROGRESS && (
                        <button
                            onClick={() => onStatusAction(wo, WOStatus.PENDING)}
                            className="p-1.5 text-txt-3 hover:text-warn hover:bg-warn-dim rounded-md transition-colors"
                            title="Pausar"
                        >
                            <PauseCircle size={16} />
                        </button>
                    )}
                    {wo.status !== WOStatus.COMPLETED && (
                        <button
                            onClick={() => onComplete(wo)}
                            className="p-1.5 text-txt-3 hover:text-ok hover:bg-ok-dim rounded-md transition-colors"
                            title="Completar"
                        >
                            <CheckSquare size={16} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {GROUP_LABELS.map(({ key, label }) => {
                const items = groups[key];
                if (items.length === 0) return null;
                return (
                    <section key={key}>
                        <h3 className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider mb-3">
                            <CalendarClock size={14} />
                            {label}
                            <span className="bdg bdg-gray">{items.length}</span>
                        </h3>
                        <div className="space-y-2">
                            {items.map(row)}
                        </div>
                    </section>
                );
            })}

            {workOrders.length === 0 && (
                <div className="text-center py-12 bg-surface rounded-xl border border-line border-dashed">
                    <CheckCircle size={48} className="mx-auto text-ok opacity-50 mb-4" />
                    <h3 className="text-lg font-medium text-txt">No hay actuaciones programadas</h3>
                    <p className="text-txt-2">Crea una actuación con el botón "Nueva Actuación".</p>
                </div>
            )}

            {stoppageWO && currentUser && (
                <StoppageFormModal
                    isOpen={true}
                    onClose={() => setStoppageWO(null)}
                    stoppage={null}
                    equipment={equipment}
                    currentUser={currentUser}
                    canManage={canCreateStoppages}
                    canDelete={false}
                    initialEquipmentId={stoppageWO.equipmentId}
                    initialStartAt={stoppageWO.scheduledDate || stoppageWO.createdAt}
                    linkedWorkOrderId={stoppageWO.id}
                    onCreate={addStoppage}
                    onUpdate={updateStoppage}
                    onDelete={deleteStoppage}
                />
            )}
        </div>
    );
};
