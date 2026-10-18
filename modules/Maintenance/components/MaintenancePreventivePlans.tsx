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
    const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'week'>('all');
    const [equipmentFilter, setEquipmentFilter] = useState('');

    // Estado del ciclo: última ejecución → próxima ejecución
    const planCycle = (plan: PreventivePlan) => {
        const next = new Date(plan.nextRun).getTime();
        const now = Date.now();
        const days = Math.ceil((next - now) / 86400000);
        const total = Math.max(plan.frequencyDays || 1, 1);
        const elapsed = plan.lastRun
            ? Math.min(total, Math.max(0, Math.floor((now - new Date(plan.lastRun).getTime()) / 86400000)))
            : total;
        return {
            days,                                     // >0: vence en X días; <0: vencido hace X
            pct: Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))),
            overdue: next <= now
        };
    };

    // Initial Filter & Sort
    const filteredPlans = useMemo(() => {
        let result = plans.filter(plan => {
            const eqName = equipment.find(e => e.id === plan.equipmentId)?.name || '';
            const matchesText = (plan.name || '').toLowerCase().includes(filterText.toLowerCase()) ||
                eqName.toLowerCase().includes(filterText.toLowerCase());
            return matchesText;
        });

        if (equipmentFilter) {
            result = result.filter(p => p.equipmentId === equipmentFilter);
        }
        if (statusFilter === 'overdue') {
            result = result.filter(p => new Date(p.nextRun).getTime() <= Date.now());
        } else if (statusFilter === 'week') {
            const inAWeek = Date.now() + 7 * 86400000;
            result = result.filter(p => {
                const t = new Date(p.nextRun).getTime();
                return t > Date.now() && t <= inAWeek;
            });
        }

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
                    <div className="font-medium text-txt">{plan.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {plan.tasks.slice(0, 3).map((t, i) => (
                            <span key={t.id || i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-spec-dim text-spec border border-spec-border">
                                {t.description}
                            </span>
                        ))}
                        {plan.tasks.length > 3 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-surface-2 text-txt-3">
                                +{plan.tasks.length - 3}
                            </span>
                        )}
                        {plan.tasks.length === 0 && (
                            <span className="text-xs text-txt-3 italic">Sin tareas definidas</span>
                        )}
                    </div>
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
                <div className="flex items-center gap-1 text-sm text-txt-2">
                    <RefreshCw size={14} className="text-txt-3" />
                    <span>Cada {plan.frequencyDays} días</span>
                </div>
            )
        },
        {
            header: "Ciclo / Próxima Ejecución",
            sortKey: "nextRun",
            render: (plan: PreventivePlan) => {
                const c = planCycle(plan);
                return (
                    <div className="min-w-[150px]">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${c.overdue ? 'text-ko font-bold' : 'text-spec'}`}>
                                {new Date(plan.nextRun).toLocaleDateString()}
                            </span>
                            {c.overdue ? (
                                <span className="bdg bdg-red shrink-0">VENCIDO</span>
                            ) : c.days <= 7 ? (
                                <span className="bdg bdg-amber shrink-0">Vence en {c.days}d</span>
                            ) : null}
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden mt-1" title={`Día ${Math.min(c.pct, 100)}% del ciclo`}>
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${c.pct}%`, background: c.overdue ? 'var(--red)' : c.days <= 7 ? 'var(--amber)' : 'var(--purple)' }}
                            />
                        </div>
                        {plan.lastRun && (
                            <div className="text-[9px] text-txt-3 mt-0.5">
                                Última: {new Date(plan.lastRun).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (plan: PreventivePlan) => (
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => onLaunch(plan.id)}
                        className="p-1.5 rounded text-spec hover:text-spec hover:bg-spec-dim transition-colors"
                        title="Lanzar Orden Manualmente"
                    >
                        <PlayCircle size={18} />
                    </button>
                    <button
                        onClick={() => onEdit(plan)}
                        className={`p-1.5 rounded transition-colors ${canManage
                            ? 'text-txt-2 hover:text-accent hover:bg-accent-dim '
                            : 'text-txt-2 hover:text-accent hover:bg-accent-dim '
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
                            className="p-1.5 text-txt-2 hover:text-ko hover:bg-ko-dim rounded transition-colors"
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
                className="bg-surface p-4 rounded-xl shadow-sm border border-line active:scale-[0.98] transition-transform cursor-pointer hover:shadow-md"
            >
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-txt">{plan.name}</h3>
                    <div className="flex gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); onLaunch(plan.id); }}
                            className="p-1 text-spec hover:scale-110 transition-transform"
                            title="Lanzar Orden"
                        >
                            <PlayCircle size={18} />
                        </button>
                        {canManage && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(plan); }}
                                    className="p-1 text-txt-3 hover:text-accent"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (confirm('¿Borrar plan?')) onDelete(plan.id); }}
                                    className="p-1 text-txt-3 hover:text-ko"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-txt-2 mb-1">
                    <Wrench size={14} className="text-txt-3" />
                    <span className="truncate">{eq?.name}</span>
                </div>
                {plan.description && (
                    <p className="text-xs text-txt-2 mb-3 line-clamp-2">{plan.description}</p>
                )}

                <div className="flex justify-between items-center text-xs text-txt-2 pt-2 border-t border-line">
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
                    <div className={`font-medium ${planCycle(plan).overdue ? 'text-ko font-bold' : 'text-spec'}`}>
                        {planCycle(plan).overdue
                            ? 'VENCIDO'
                            : planCycle(plan).days <= 7
                                ? `Vence en ${planCycle(plan).days}d`
                                : `Próx: ${new Date(plan.nextRun).toLocaleDateString()}`}
                    </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden mt-2">
                    <div
                        className="h-full rounded-full"
                        style={{
                            width: `${planCycle(plan).pct}%`,
                            background: planCycle(plan).overdue ? 'var(--red)' : planCycle(plan).days <= 7 ? 'var(--amber)' : 'var(--purple)'
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-surface p-4 rounded-xl shadow-sm border border-line space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    {([
                        { id: 'all' as const, label: 'Todos' },
                        { id: 'overdue' as const, label: 'Vencidos' },
                        { id: 'week' as const, label: 'Esta semana' }
                    ]).map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setStatusFilter(opt.id)}
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold border transition-colors ${statusFilter === opt.id
                                ? opt.id === 'overdue' ? 'bg-ko text-white border-ko' : 'bg-accent text-white border-accent'
                                : 'bg-surface text-txt-2 border-line hover:bg-surface-2'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    <select
                        value={equipmentFilter}
                        onChange={(e) => setEquipmentFilter(e.target.value)}
                        className="fld-input px-2.5 py-1.5 rounded-[6px] text-xs ml-auto"
                    >
                        <option value="">Todos los equipos</option>
                        {equipment.map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.name}</option>
                        ))}
                    </select>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar planes preventivos..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-line rounded-lg bg-surface-2 text-txt focus:ring-2 focus:ring-accent"
                    />
                </div>
            </div>

            {filteredPlans.length > 0 ? (
                <div className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
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
                <div className="text-center py-12 bg-surface rounded-xl border border-line border-dashed">
                    <CheckSquare size={48} className="mx-auto text-txt-3 mb-4" />
                    <h3 className="text-lg font-medium text-txt">No hay planes preventivos</h3>
                    <p className="text-txt-2">Define nuevos planes para automatizar el mantenimiento.</p>
                </div>
            )}
        </div>
    );
};
