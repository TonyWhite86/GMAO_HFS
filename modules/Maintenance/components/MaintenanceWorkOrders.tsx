import React, { useMemo, useState } from 'react';
import { Search, Filter, CheckSquare, PlayCircle, PauseCircle, AlertTriangle, Building2, ClipboardCheck, CalendarClock } from 'lucide-react';
import { WorkOrder, WOStatus, WOPriority, User, Equipment } from '../../../types';
import { GenericTable, Column } from '../../../components/GenericTable';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { PriorityIndicator } from '../../../components/common/PriorityIndicator';
import { WorkOrderCard } from '../../../components/workOrder/WorkOrderCard';
import { CollaboratorsCell } from './CollaboratorsCell';
import { useWorkOrderFilters, SortKey } from '../../../hooks/useWorkOrderFilters';
import { WO_STATUS_CONFIG, WO_TYPE_CONFIG } from '../../../constants';
import { getDueLabel, getDueTone, quickDate, hasPendingChecklist } from '../../../utils/maintenanceStats';

interface MaintenanceWorkOrdersProps {
    workOrders: WorkOrder[];
    users: User[];
    equipment: Equipment[];
    onSelectWO: (id: string) => void;
    onStatusAction: (wo: WorkOrder, nextStatus: WOStatus) => void;
    onComplete: (wo: WorkOrder) => void;
    onUpdateWO?: (wo: WorkOrder, updates: Partial<WorkOrder>) => void;
    viewMode?: 'workOrders' | 'plannedActions';
    initialFilters?: any;
}

const ITEMS_PER_PAGE = 15;

const QUICK_DATES = [
    { label: '+7d', days: 7 },
    { label: '+15d', days: 15 },
    { label: '+30d', days: 30 }
];

export const MaintenanceWorkOrders: React.FC<MaintenanceWorkOrdersProps> = ({
    workOrders,
    users,
    equipment,
    onSelectWO,
    onStatusAction,
    onComplete,
    onUpdateWO,
    viewMode = 'workOrders',
    initialFilters
}) => {
    const {
        filterText, setFilterText,
        activeStatuses, toggleStatusFilter,
        selectedPriorities, togglePriorityFilter,
        selectedSections, toggleSectionFilter,
        showUnassigned, setShowUnassigned,
        dueByTomorrow, setDueByTomorrow,
        startDate, setStartDate,
        endDate, setEndDate,
        sortConfig, handleSort,
        filteredWOs
    } = useWorkOrderFilters(
        workOrders,
        initialFilters,
        viewMode,
        users,
        equipment
    );

    const [currentPage, setCurrentPage] = useState(1);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const sortedWOs = filteredWOs;

    // ── KPIs de la vista (clicables para filtrar) ──
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const kpiOpen = workOrders.filter(w => w.status === WOStatus.PENDING).length;
    const kpiInProgress = workOrders.filter(w => w.status === WOStatus.IN_PROGRESS).length;
    const kpiDoneWeek = workOrders.filter(w =>
        w.status === WOStatus.COMPLETED && w.closedAt && new Date(w.closedAt).getTime() >= weekAgo
    ).length;

    const columns = useMemo((): Column<WorkOrder>[] => [
        {
            header: "ID / Título",
            sortKey: "title",
            render: (wo: WorkOrder) => (
                <div>
                    <div className="font-medium text-txt group-hover:text-accent transition-colors flex items-center gap-1.5">
                        {wo.title}
                        {wo.isExternal && (
                            <span className="bdg bdg-purple shrink-0" title={wo.contractorName ? `Externa · ${wo.contractorName}` : 'OT externa'}>
                                <Building2 size={10} />
                            </span>
                        )}
                        {hasPendingChecklist(wo) && (
                            <span className="bdg bdg-amber shrink-0" title="Checklist de cierre sin responder">
                                <ClipboardCheck size={10} />
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-txt-2">#{wo.id}</div>
                </div>
            )
        },
        {
            header: "Tipo",
            render: (wo: WorkOrder) => {
                const typeConfig = WO_TYPE_CONFIG[wo.type];
                return (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-current opacity-75 ${typeConfig?.bgClass}`}>
                        {typeConfig?.label || wo.type}
                    </span>
                );
            },
        },
        {
            header: "Estado",
            sortKey: "status",
            render: (wo: WorkOrder) => <StatusBadge status={wo.status} type="workOrder" />
        },
        {
            header: "Prioridad",
            sortKey: "priority",
            render: (wo: WorkOrder) => <PriorityIndicator priority={wo.priority} />
        },
        {
            header: "Equipo",
            render: (wo: WorkOrder) => {
                const eq = equipment.find(e => e.id === wo.equipmentId);
                if (!eq) return 'Desconocido';
                return eq.code ? `[${eq.code}] ${eq.name}` : eq.name;
            }
        },
        {
            header: "Asignado a",
            render: (wo: WorkOrder) => <CollaboratorsCell wo={wo} users={users} />
        },
        {
            header: "Fecha",
            sortKey: "date",
            render: (wo: WorkOrder) => {
                const date = new Date(wo.scheduledDate || wo.createdAt);
                const due = getDueLabel(wo);
                const tone = getDueTone(wo);
                const toneClass = tone === 'ko' ? 'text-ko font-bold'
                    : tone === 'warn' ? 'text-warn font-bold'
                        : tone === 'accent' ? 'text-accent font-medium' : 'text-txt-2';
                return (
                    <div className="group/date relative">
                        <div className="flex items-center gap-1.5 text-sm">
                            {due === 'Vencida' && <AlertTriangle size={13} className="text-ko shrink-0" />}
                            <span className={toneClass}>
                                {date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            {due && due !== 'Vencida' && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tone === 'warn' ? 'bg-warn-dim text-warn' : 'bg-accent-dim text-accent'}`}>
                                    {due}
                                </span>
                            )}
                            {due === 'Vencida' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-ko-dim text-ko">Vencida</span>
                            )}
                        </div>
                        {onUpdateWO && wo.status !== WOStatus.COMPLETED && (
                            <div className="hidden group-hover/date:flex items-center gap-1 pt-1">
                                {QUICK_DATES.map(q => (
                                    <button
                                        key={q.label}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateWO(wo, { scheduledDate: quickDate(q.days) });
                                        }}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-line text-txt-2 hover:bg-accent-dim hover:text-accent hover:border-accent-border transition-colors"
                                        title={`Programar a ${q.label} desde hoy`}
                                    >
                                        {q.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (wo: WorkOrder) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {wo.status === WOStatus.PENDING && onStatusAction && (
                        <button
                            onClick={() => onStatusAction(wo, WOStatus.IN_PROGRESS)}
                            className="p-1.5 text-txt-3 hover:text-ok hover:bg-ok-dim rounded-md transition-colors"
                            title="Iniciar"
                        >
                            <PlayCircle size={16} />
                        </button>
                    )}
                    {wo.status === WOStatus.IN_PROGRESS && onStatusAction && (
                        <button
                            onClick={() => onStatusAction(wo, WOStatus.PENDING)}
                            className="p-1.5 text-txt-3 hover:text-warn hover:bg-warn-dim rounded-md transition-colors"
                            title="Pausar"
                        >
                            <PauseCircle size={16} />
                        </button>
                    )}
                    {wo.status !== WOStatus.COMPLETED && onComplete && (
                        <button
                            onClick={() => onComplete(wo)}
                            className="p-1.5 text-txt-3 hover:text-ok hover:bg-ok-dim rounded-md transition-colors"
                            title="Completar"
                        >
                            <CheckSquare size={16} />
                        </button>
                    )}
                    {wo.status === WOStatus.COMPLETED && (
                        <span className="text-[9px] font-bold text-ok bg-ok-dim px-1.5 py-0.5 rounded-full">
                            {wo.closedAt ? new Date(wo.closedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : 'OK'}
                        </span>
                    )}
                </div>
            )
        }
    ], [equipment, users, sortConfig, onUpdateWO, onStatusAction, onComplete]);

    return (
        <div className="space-y-4">
            {/* KPIs de la vista */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={() => toggleStatusFilter(WOStatus.PENDING)}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold border transition-colors ${activeStatuses.includes(WOStatus.PENDING) && activeStatuses.length === 1
                        ? 'bg-warn text-white border-warn' : 'bg-surface text-txt-2 border-line hover:bg-surface-2'}`}
                >
                    Pendientes · {kpiOpen}
                </button>
                <button
                    onClick={() => toggleStatusFilter(WOStatus.IN_PROGRESS)}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold border transition-colors ${activeStatuses.includes(WOStatus.IN_PROGRESS) && activeStatuses.length === 1
                        ? 'bg-accent text-white border-accent' : 'bg-surface text-txt-2 border-line hover:bg-surface-2'}`}
                >
                    En curso · {kpiInProgress}
                </button>
                <button
                    onClick={() => toggleStatusFilter(WOStatus.COMPLETED)}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold border transition-colors ${activeStatuses.includes(WOStatus.COMPLETED) && activeStatuses.length === 1
                        ? 'bg-ok text-white border-ok' : 'bg-surface text-txt-2 border-line hover:bg-surface-2'}`}
                >
                    Completadas (7d) · {kpiDoneWeek}
                </button>
                <button
                    onClick={() => setDueByTomorrow(!dueByTomorrow)}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-bold border transition-colors ${dueByTomorrow
                        ? 'bg-ko text-white border-ko' : 'bg-surface text-txt-2 border-line hover:bg-surface-2'}`}
                >
                    <CalendarClock size={12} className="inline mr-1 -mt-0.5" />
                    ≤ Mañana
                </button>
            </div>

            {/* Filters */}
            <div className="bg-surface p-4 rounded-xl shadow-sm border border-line space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar órdenes..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-line rounded-lg bg-surface-2 text-txt focus:ring-2 focus:ring-accent"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.values(WOStatus).map(status => {
                            const config = WO_STATUS_CONFIG[status];
                            const count = workOrders.filter(w => w.status === status).length;
                            return (
                                <button
                                    key={status}
                                    onClick={() => toggleStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${activeStatuses.includes(status)
                                        ? config.bgClass
                                        : 'bg-surface text-txt-2 border-line hover:border-line-2'
                                        }`}
                                >
                                    {status} · {count}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`p-2 rounded-lg border transition-colors ${showAdvancedFilters
                            ? 'bg-accent-dim border-accent-border text-accent'
                            : 'bg-surface border-line text-txt-2'
                            }`}
                    >
                        <Filter size={20} />
                    </button>
                </div>

                {showAdvancedFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-line animate-in slide-in-from-top-2">
                        <div>
                            <label className="text-xs font-bold text-txt-2 uppercase mb-2 block">Prioridad</label>
                            <div className="space-y-1">
                                {Object.values(WOPriority).map(priority => (
                                    <label key={priority} className="flex items-center gap-2 text-sm text-txt-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedPriorities.includes(priority)}
                                            onChange={() => togglePriorityFilter(priority)}
                                            className="rounded text-accent focus:ring-accent"
                                        />
                                        {priority}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-txt-2 uppercase mb-2 block">Fecha</label>
                            <div className="space-y-2">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-2 border rounded" />
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm p-2 border rounded" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-txt-2 uppercase mb-2 block">Asignación</label>
                            <label className="flex items-center gap-2 text-sm text-txt-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showUnassigned}
                                    onChange={(e) => setShowUnassigned(e.target.checked)}
                                    className="rounded text-accent focus:ring-accent"
                                />
                                Mostrar solo Sin Asignar
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Content using GenericTable */}
            {sortedWOs.length > 0 ? (
                <div>
                    <GenericTable
                        columns={columns}
                        data={sortedWOs}
                        onRowClick={(wo) => onSelectWO(wo.id)}
                        itemsPerPage={ITEMS_PER_PAGE}
                        renderCard={(wo) => (
                            <WorkOrderCard
                                wo={wo}
                                equipment={equipment}
                                users={users}
                                onClick={() => onSelectWO(wo.id)}
                                onStatusAction={onStatusAction}
                                onComplete={onComplete}
                            />
                        )}
                        sortConfig={sortConfig ? { key: sortConfig.key, direction: sortConfig.direction } : null}
                        onSort={(key) => handleSort(key as SortKey)}
                    />
                </div>
            ) : (
                <div className="text-center py-12 bg-surface rounded-xl border border-line border-dashed">
                    <CheckSquare size={48} className="mx-auto text-txt-3 mb-4" />
                    <h3 className="text-lg font-medium text-txt">No hay órdenes de trabajo</h3>
                    <p className="text-txt-2">Intenta ajustar los filtros o crea una nueva orden.</p>
                </div>
            )}
        </div>
    );
};
