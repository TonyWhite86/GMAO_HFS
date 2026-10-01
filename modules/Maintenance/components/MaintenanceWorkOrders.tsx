import React, { useState, useMemo } from 'react';
import { WorkOrder, User, Equipment, WOPriority, WOStatus } from '../../../types';
import { useWorkOrderFilters, SortKey } from '../../../hooks/useWorkOrderFilters';
import { GenericTable } from '../../../components/GenericTable';
import { WorkOrderCard } from '../../../components/workOrder/WorkOrderCard';
import { CollaboratorsCell } from './CollaboratorsCell';
import { Search, Filter, User as UserIcon, Calendar, CheckSquare } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { PriorityIndicator } from '../../../components/common/PriorityIndicator';
import { WO_STATUS_CONFIG, WO_TYPE_CONFIG } from '../../../constants';



interface MaintenanceWorkOrdersProps {
    workOrders: WorkOrder[];
    users: User[];
    equipment: Equipment[];
    onSelectWO: (id: string) => void;
    onStatusAction: (wo: WorkOrder, nextStatus: WOStatus) => void;
    onComplete: (wo: WorkOrder) => void;
    viewMode?: 'workOrders' | 'plannedActions';
    initialFilters?: any;
}

const ITEMS_PER_PAGE = 30;

export const MaintenanceWorkOrders: React.FC<MaintenanceWorkOrdersProps> = ({
    workOrders,
    users,
    equipment,
    onSelectWO,
    onStatusAction,
    onComplete,
    viewMode = 'workOrders',
    initialFilters
}) => {
    const {
        filterText, setFilterText,
        activeStatuses, toggleStatusFilter,
        selectedPriorities, togglePriorityFilter,
        selectedSections, toggleSectionFilter,
        showUnassigned, setShowUnassigned,
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
    // Removed external pagination logic since GenericTable handles it

    const columns = useMemo(() => [
        {
            header: "ID / Título",
            sortKey: "title",
            render: (wo: WorkOrder) => (
                <div>
                    <div className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{wo.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">#{wo.id}</div>
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
            render: (wo: WorkOrder) => (
                <StatusBadge status={wo.status} type="workOrder" />
            )
        },
        {
            header: "Prioridad",
            sortKey: "priority",
            render: (wo: WorkOrder) => (
                <PriorityIndicator priority={wo.priority} />
            )
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
            render: (wo: WorkOrder) => (
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {wo.scheduledDate
                        ? <span className="text-purple-600 dark:text-purple-400 font-medium">{new Date(wo.scheduledDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        : new Date(wo.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
            )
        }
    ], [equipment, users, sortConfig]);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar órdenes..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.values(WOStatus).map(status => {
                            const config = WO_STATUS_CONFIG[status];
                            return (
                                <button
                                    key={status}
                                    onClick={() => toggleStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${activeStatuses.includes(status)
                                        ? config.bgClass
                                        : 'bg-white dark:bg-slate-700 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                        }`}
                                >
                                    {status}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={`p-2 rounded-lg border transition-colors ${showAdvancedFilters
                            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                            : 'bg-white border-slate-200 text-slate-500 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                    >
                        <Filter size={20} />
                    </button>
                </div>

                {showAdvancedFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Prioridad</label>
                            <div className="space-y-1">
                                {Object.values(WOPriority).map(priority => (
                                    <label key={priority} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedPriorities.includes(priority)}
                                            onChange={() => togglePriorityFilter(priority)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        {priority}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Fecha</label>
                            <div className="space-y-2">
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-2 border rounded" />
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm p-2 border rounded" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Asignación</label>
                            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showUnassigned}
                                    onChange={(e) => setShowUnassigned(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500"
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
                <div className="text-center py-12 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
                    <CheckSquare size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No hay órdenes de trabajo</h3>
                    <p className="text-slate-500 dark:text-slate-400">Intenta ajustar los filtros o crea una nueva orden.</p>
                </div>
            )}
        </div>
    );
};
