import React, { useState, useMemo } from 'react';
import { PreventivePlan, Equipment, SortKey } from '../../../types';
import { GenericTable } from '../../../components/GenericTable';
import { Search, RefreshCw, PlayCircle, Edit2, Eye, Trash2, Wrench, ListPlus, ArrowUp, ArrowDown, ArrowUpDown, CheckSquare } from 'lucide-react';

interface MaintenancePreventivePlansProps {
    plans: PreventivePlan[];
    equipment: Equipment[];
    canManage: boolean;
    onLaunch: (planId: string) => void;
    onEdit: (plan: PreventivePlan) => void;
    onDelete: (planId: string) => void;
}

const ITEMS_PER_PAGE = 30;

export const MaintenancePreventivePlans: React.FC<MaintenancePreventivePlansProps> = ({
    plans,
    equipment,
    canManage,
    onLaunch,
    onEdit,
    onDelete
}) => {
    const [filterText, setFilterText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

    // Initial Filter & Sort
    const filteredPlans = useMemo(() => {
        let result = plans.filter(plan => {
            const eqName = equipment.find(e => e.id === plan.equipmentId)?.name || '';
            const matchesText = (plan.name || '').toLowerCase().includes(filterText.toLowerCase()) ||
                eqName.toLowerCase().includes(filterText.toLowerCase());
            return matchesText;
        });

        if (sortConfig) {
            result = [...result].sort((a, b) => {
                let aValue: any = a[sortConfig.key as keyof PreventivePlan];
                let bValue: any = b[sortConfig.key as keyof PreventivePlan];

                if (sortConfig.key === 'nextRun') {
                    aValue = new Date(a.nextRun).getTime();
                    bValue = new Date(b.nextRun).getTime();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [plans, equipment, filterText, sortConfig]);

    // GenericTable handles sort and pagination internally or via props.
    // We will leverage GenericTable completely.

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const columns = useMemo(() => [
        {
            header: "Nombre del Plan",
            sortKey: "name",
            render: (plan: PreventivePlan) => (
                <div>
                    <div className="font-medium text-slate-900 dark:text-white">{plan.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{plan.tasks.length} tareas definidas</div>
                </div>
            )
        },
        {
            header: "Equipo",
            render: (plan: PreventivePlan) => {
                const eq = equipment.find(e => e.id === plan.equipmentId);
                if (!eq) return 'Unknown';
                return eq.code ? `[${eq.code}] ${eq.name}` : eq.name;
            }
        },
        {
            header: "Frecuencia",
            render: (plan: PreventivePlan) => (
                <div className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                    <RefreshCw size={14} className="text-slate-400" />
                    <span>Cada {plan.frequencyDays} días</span>
                </div>
            )
        },
        {
            header: "Próxima Ejecución",
            sortKey: "nextRun",
            render: (plan: PreventivePlan) => (
                <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    {new Date(plan.nextRun).toLocaleDateString()}
                </span>
            )
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (plan: PreventivePlan) => (
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => onLaunch(plan.id)}
                        className="p-1.5 rounded text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                        title="Lanzar Orden Manualmente"
                    >
                        <PlayCircle size={18} />
                    </button>
                    <button
                        onClick={() => onEdit(plan)}
                        className={`p-1.5 rounded transition-colors ${canManage
                            ? 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            }`}
                        title={canManage ? "Editar" : "Ver Detalles"}
                    >
                        {canManage ? <Edit2 size={16} /> : <Eye size={16} />}
                    </button>
                    {canManage && (
                        <button
                            onClick={() => {
                                if (window.confirm('¿Estás seguro de que deseas eliminar este plan preventivo?')) {
                                    onDelete(plan.id);
                                }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )
        }
    ], [equipment, canManage, onLaunch, onDelete, sortConfig]);

    const renderCard = (plan: PreventivePlan) => {
        const eq = equipment.find(e => e.id === plan.equipmentId);
        return (
            <div
                key={plan.id}
                onClick={() => onEdit(plan)}
                className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 active:scale-[0.98] transition-transform cursor-pointer hover:shadow-md"
            >
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                    <div className="flex gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onLaunch(plan.id); }}
                            className="p-1 text-purple-500 hover:scale-110 transition-transform"
                            title="Lanzar Orden"
                        >
                            <PlayCircle size={18} />
                        </button>
                        {canManage && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(plan); }}
                                    className="p-1 text-slate-400 hover:text-blue-500"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (confirm('¿Borrar plan?')) onDelete(plan.id); }}
                                    className="p-1 text-slate-400 hover:text-red-500"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 mb-1">
                    <Wrench size={14} className="text-slate-400" />
                    <span className="truncate">{eq?.name}</span>
                </div>
                {plan.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{plan.description}</p>
                )}

                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <RefreshCw size={12} />
                            <span>{plan.frequencyDays} días</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <ListPlus size={12} />
                            <span>{plan.tasks.length} tareas</span>
                        </div>
                    </div>
                    <div className="text-purple-600 dark:text-purple-400 font-medium">
                        Próx: {new Date(plan.nextRun).toLocaleDateString()}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar planes preventivos..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {filteredPlans.length > 0 ? (
                <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <GenericTable
                        columns={columns}
                        data={filteredPlans}
                        onRowClick={(plan) => onEdit(plan)}
                        itemsPerPage={ITEMS_PER_PAGE}
                        renderCard={renderCard}
                        sortConfig={sortConfig ? { key: sortConfig.key, direction: sortConfig.direction } : null}
                        onSort={(key) => handleSort(key as SortKey)}
                    />
                </div>
            ) : (
                <div className="text-center py-12 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
                    <CheckSquare size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">No hay planes preventivos</h3>
                    <p className="text-slate-500 dark:text-slate-400">Define nuevos planes para automatizar el mantenimiento.</p>
                </div>
            )}
        </div>
    );
};
