import React, { useMemo, useState } from 'react';
import { CalendarClock, PlayCircle, PauseCircle, CheckSquare, CalendarPlus, AlertTriangle, CheckCircle, Search, History, Building2 } from 'lucide-react';
import { WorkOrder, WOStatus, User, Equipment } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { usePermissions } from '../../../hooks/usePermissions';
import { StoppageFormModal } from '../../Stoppages/components/StoppageFormModal';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { CollaboratorsCell } from './CollaboratorsCell';
import { groupByTimeframe, getDueLabel, getDueTone } from '../../../utils/maintenanceStats';
import { formatDateRange } from '../../../utils/dateUtils';
import { normalizeForSearch } from '../../../utils/searchUtils';

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
    const [filterText, setFilterText] = useState('');
    const [view, setView] = useState<'scheduled' | 'history'>('scheduled');

    const matchesSearch = (wo: WorkOrder): boolean => {
        const q = normalizeForSearch(filterText.trim());
        if (!q) return true;
        const eq = equipment.find(e => e.id === wo.equipmentId);
        return normalizeForSearch(`${wo.title} ${eq?.name || ''}`).includes(q);
    };

    // Programadas = activas (no completadas). Historial = completadas.
    const active = useMemo(
        () => workOrders.filter(w => w.status !== WOStatus.COMPLETED && matchesSearch(w)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [workOrders, equipment, filterText]
    );
    const history = useMemo(
        () => workOrders
            .filter(w => w.status === WOStatus.COMPLETED && matchesSearch(w))
            .sort((a, b) => new Date(b.closedAt || b.createdAt).getTime() - new Date(a.closedAt || a.createdAt).getTime()),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [workOrders, equipment, filterText]
    );

    const groups = groupByTimeframe(active);

    const actionsCell = (wo: WorkOrder, withStoppage: boolean) => (
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {withStoppage && canCreateStoppages && (
                <button
                    onClick={() => setStoppageWO(wo)}
                    className="p-1.5 text-txt-3 hover:text-warn hover:bg-warn-dim rounded-md transition-colors"
                    title="Programar parada de equipo asociada"
                >
                    <CalendarPlus size={16} />
                </button>
            )}
            {!wo.isExternal && wo.status === WOStatus.PENDING && (
                <button
                    onClick={() => onStatusAction(wo, WOStatus.IN_PROGRESS)}
                    className="p-1.5 text-txt-3 hover:text-ok hover:bg-ok-dim rounded-md transition-colors"
                    title="Iniciar"
                >
                    <PlayCircle size={16} />
                </button>
            )}
            {!wo.isExternal && wo.status === WOStatus.IN_PROGRESS && (
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
    );

    const row = (wo: WorkOrder, withStoppage: boolean) => {
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
                        {wo.isExternal && (
                            <span className="bdg bdg-purple shrink-0">
                                <Building2 size={10} /> Externa{wo.contractorName ? ` · ${wo.contractorName}` : ''}
                            </span>
                        )}
                        {(wo.collaboratingSections || []).map(sec => (
                            <span key={sec} className="bdg bdg-purple shrink-0">{sec}</span>
                        ))}
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
                    {wo.status === WOStatus.COMPLETED ? (
                        <div className="text-sm font-bold text-ok">
                            {wo.closedAt
                                ? `Cerrada ${new Date(wo.closedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                                : 'Completada'}
                        </div>
                    ) : (
                        <div className={`text-sm font-bold ${tone === 'ko' ? 'text-ko' : tone === 'warn' ? 'text-warn' : 'text-txt'}`}>
                            {wo.scheduledEndDate
                                ? formatDateRange(wo.scheduledDate || wo.createdAt, wo.scheduledEndDate)
                                : `${date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} · ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                    )}
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                        <StatusBadge status={wo.status} type="workOrder" />
                    </div>
                </div>

                {actionsCell(wo, withStoppage)}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Buscador + mini-vistas */}
            <div className="bg-surface p-4 rounded-xl shadow-sm border border-line space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar actuaciones por título o equipo..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-line rounded-lg bg-surface-2 text-txt focus:ring-2 focus:ring-accent"
                    />
                </div>
                <div className="tabs w-fit">
                    <button
                        onClick={() => setView('scheduled')}
                        className={`tab ${view === 'scheduled' ? 'active' : ''}`}
                    >
                        <CalendarClock size={13} className="mr-1.5 inline -mt-0.5" />
                        Programadas
                        <span className="bdg bdg-gray ml-1.5">{active.length}</span>
                    </button>
                    <button
                        onClick={() => setView('history')}
                        className={`tab ${view === 'history' ? 'active' : ''}`}
                    >
                        <History size={13} className="mr-1.5 inline -mt-0.5" />
                        Historial
                        <span className="bdg bdg-gray ml-1.5">{history.length}</span>
                    </button>
                </div>
            </div>

            {view === 'scheduled' ? (
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
                                    {items.map(wo => row(wo, true))}
                                </div>
                            </section>
                        );
                    })}
                    {active.length === 0 && (
                        <div className="text-center py-12 bg-surface rounded-xl border border-line border-dashed">
                            <CheckCircle size={48} className="mx-auto text-ok opacity-50 mb-4" />
                            <h3 className="text-lg font-medium text-txt">No hay actuaciones programadas</h3>
                            <p className="text-txt-2">
                                {filterText ? 'Ninguna coincide con la búsqueda.' : 'Crea una actuación con el botón "Nueva Actuación".'}
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {history.map(wo => (
                        <div key={wo.id} className="relative">
                            <div className="opacity-95">{row(wo, false)}</div>
                        </div>
                    ))}
                    {history.length === 0 && (
                        <div className="text-center py-12 bg-surface rounded-xl border border-line border-dashed">
                            <History size={48} className="mx-auto text-txt-3 opacity-50 mb-4" />
                            <h3 className="text-lg font-medium text-txt">Sin histórico todavía</h3>
                            <p className="text-txt-2">
                                {filterText ? 'Ninguna coincide con la búsqueda.' : 'Las actuaciones completadas aparecerán aquí.'}
                            </p>
                        </div>
                    )}
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
