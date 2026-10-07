import React, { useState, useMemo, useEffect } from 'react';
import { WorkOrder, InventoryItem, Equipment, User, WOStatus, UserRole, WOType, Incident, IncidentStatus, IncidentCategory } from '../types';
import {
    LayoutDashboard, Users, Package, Wrench, Search, ChevronRight,
    Clock, DollarSign, Activity, AlertCircle, AlertTriangle, CheckCircle2, TrendingUp,
    Calendar, MapPin, Box, FileText, ArrowUpRight, Download
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { computeActiveMinutes } from '../utils/timeTracking';
import { computeIncidentStats, computeMonthlySeries, computeDistribution } from '../utils/incidentStats';
import { canSeeIncident } from '../utils/incidentVisibility';
import { useVisibleCategories } from '../hooks/useVisibleCategories';
import { reportService } from '../services/reportService';

export interface ReportsProps { }

type EntityType = 'worker' | 'machine' | 'inventory' | 'incident';

// --- Reusable Components ---

// StatCard moved to components/ui/StatCard.tsx

const HistoryTable = ({ data, columns }: { data: any[], columns: { header: string, accessor: (item: any) => React.ReactNode, width?: string }[] }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                    {columns.map((col, i) => (
                        <th key={i} className={`px-4 py-3 font-medium ${col.width || ''}`}>{col.header}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                        {columns.map((col, j) => (
                            <td key={j} className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                                {col.accessor(item)}
                            </td>
                        ))}
                    </tr>
                ))}
                {data.length === 0 && (
                    <tr>
                        <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 italic">
                            No hay datos disponibles
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    </div>
);

// --- Detail Views ---

// Helper to safely get duration
const getDuration = (wo: WorkOrder) => {
    // 1. If Completed and has manual/saved time, use it.
    if (wo.status === WOStatus.COMPLETED && wo.timeSpentMinutes !== undefined && wo.timeSpentMinutes !== null) {
        return wo.timeSpentMinutes;
    }

    // 2. If has history, derive from history (no mixing with savedMinutes)
    if (wo.statusHistory && wo.statusHistory.length > 0) {
        return computeActiveMinutes(wo.status, wo.statusHistory, wo.timeSpentMinutes);
    }

    // 3. Fallback for legacy data (Simple Diff)
    if (wo.timeSpentMinutes !== undefined && wo.timeSpentMinutes !== null) return wo.timeSpentMinutes;

    if (wo.status === WOStatus.COMPLETED && wo.createdAt) {
        const end = wo.closedAt ? new Date(wo.closedAt).getTime() : Date.now();
        return Math.max(0, Math.floor((end - new Date(wo.createdAt).getTime()) / 60000));
    }

    return 0;
};

const WorkerDetails = ({ worker, workOrders, inventory }: { worker: User, workOrders: WorkOrder[], inventory: InventoryItem[] }) => {
    // Los KPIs numéricos salen de report_worker_stats (BD), para que el número
    // sea el mismo venga de donde venga la consulta. El histórico de abajo sigue
    // saliendo de las OTs ya cargadas en el store.
    const [viewStats, setViewStats] = useState<{
        count: number; totalMinutes: number; avgMinutes: number; manualMinutes: number;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;
        reportService.getWorkerStats()
            .then(rows => {
                if (cancelled) return;
                const row = rows.find(r => r.workerId === worker.id);
                if (row) {
                    setViewStats({
                        count: row.completedCount,
                        totalMinutes: row.totalMinutes,
                        avgMinutes: row.avgMinutes,
                        manualMinutes: row.manualMinutes
                    });
                }
            })
            .catch(err => console.warn('No se pudo cargar report_worker_stats:', err));
        return () => { cancelled = true; };
    }, [worker.id]);

    const stats = useMemo(() => {
        const completedWOs = workOrders.filter(wo => wo.assignedUserId === worker.id && wo.status === WOStatus.COMPLETED);

        // Total Time
        const totalMinutes = completedWOs.reduce((acc, wo) => acc + getDuration(wo), 0);
        const totalHours = totalMinutes / 60;

        // Avg Time
        const avgMinutes = completedWOs.length > 0 ? totalMinutes / completedWOs.length : 0;

        // Efficiency (Mocked: Base 100% +/- random based on performance)
        const efficiency = completedWOs.length > 0 ? (100 - (avgMinutes > 60 ? 10 : 0) + (completedWOs.length * 2)) : 100;

        // Material Cost
        const totalMaterialCost = completedWOs.reduce((acc, wo) => {
            const partsCost = wo.usedParts?.reduce((pAcc, part) => {
                const item = inventory.find(i => i.id === part.partId);
                return pAcc + (item ? item.price * part.quantity : 0);
            }, 0) || 0;
            return acc + partsCost;
        }, 0);

        // Tiempo escrito a mano vs medido por sesiones. Un % alto delata a
        // quien nunca pulsa Iniciar/Finalizar.
        const manualMinutes = completedWOs
            .filter(wo => wo.timeSource === 'manual')
            .reduce((acc, wo) => acc + getDuration(wo), 0);
        const manualPct = totalMinutes > 0 ? (manualMinutes / totalMinutes) * 100 : 0;

        // Si la vista respondió, manda ella (fuente única en BD).
        const finalMinutes = viewStats?.totalMinutes ?? totalMinutes;
        const finalCount = viewStats?.count ?? completedWOs.length;
        const finalManual = viewStats?.manualMinutes ?? manualMinutes;
        const finalPct = finalMinutes > 0 ? (finalManual / finalMinutes) * 100 : 0;

        return {
            totalHours: finalMinutes / 60,
            avgMinutes: viewStats?.avgMinutes ?? avgMinutes,
            efficiency, totalMaterialCost,
            count: finalCount, history: completedWOs,
            manualMinutes: finalManual, manualPct: finalPct
        };
    }, [worker, workOrders, inventory, viewStats]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-xl font-bold">
                    {worker.name.charAt(0)}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{worker.name}</h2>
                    <p className="text-slate-500">{worker.role} • {worker.email}</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Órdenes Completadas"
                    value={stats.count}
                    icon={CheckCircle2}
                    color="green"
                />
                <StatCard
                    title="Horas Totales"
                    value={`${stats.totalHours.toFixed(1)}h`}
                    icon={Clock}
                    color="blue"
                />
                <StatCard
                    title="Coste Material"
                    value={`${stats.totalMaterialCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`}
                    icon={DollarSign}
                    color="amber"
                />
                <StatCard
                    title="Eficiencia Est."
                    value={`${stats.efficiency.toFixed(0)}%`}
                    icon={Activity}
                    color="purple"
                />
                <div className={stats.manualPct >= 50 ? 'ring-2 ring-amber-400 rounded-xl' : ''}>
                    <StatCard
                        title="Tiempo a mano"
                        value={`${stats.manualPct.toFixed(0)}%`}
                        icon={AlertTriangle}
                        color={stats.manualPct >= 50 ? 'amber' : 'slate'}
                    />
                </div>
            </div>
            {stats.manualPct >= 50 && stats.count > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <p>
                        <strong>Atención:</strong> {stats.manualPct.toFixed(0)}% del tiempo de este trabajador
                        ({stats.manualMinutes} min de {Math.round(stats.totalHours * 60)} min) está <strong>escrito a mano</strong>,
                        no medido por sesiones de trabajo. Revísalo si no cuadra con lo observado.
                    </p>
                </div>
            )}

            {/* History Table */}
            <div className="bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white">
                    Historial de Trabajos Recientes
                </div>
                <HistoryTable
                    data={stats.history.slice(0, 10)}
                    columns={[
                        { header: 'Fecha', accessor: (wo) => new Date(wo.createdAt).toLocaleDateString() },
                        { header: 'Orden', accessor: (wo) => <span className="font-medium text-blue-600 hover:underline cursor-pointer">{wo.id}</span> },
                        { header: 'Tarea', accessor: (wo) => wo.title },
                        { header: 'Tiempo', accessor: (wo) => <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-xs">{getDuration(wo)} min</span> },
                        {
                            header: 'Origen',
                            accessor: (wo) => wo.timeSource === 'manual'
                                ? <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase">Manual</span>
                                : wo.timeSource === 'sesion'
                                    ? <span className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">Medido</span>
                                    : <span className="text-slate-400 text-xs">—</span>
                        },
                        {
                            header: 'Coste',
                            accessor: (wo) => ((wo.usedParts?.reduce((acc: number, p: any) => {
                                const item = inventory.find(i => i.id === p.partId);
                                return acc + (item ? item.price * p.quantity : 0);
                            }, 0) || 0) + ((getDuration(wo) / 60) * 30)).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                        }
                    ]}
                />
            </div>
        </div>
    );
};

const MachineDetails = ({ machine, workOrders, inventory }: { machine: Equipment, workOrders: WorkOrder[], inventory: InventoryItem[] }) => {
    // KPIs desde report_equipment_stats (BD); si la vista no responde se cae
    // al cálculo local con lo que haya en el store.
    const [view, setView] = useState<{
        correctiveCount: number; partsCost: number; laborCost: number; totalWOs: number;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;
        reportService.getEquipmentStats()
            .then(rows => {
                if (cancelled) return;
                const row = rows.find(r => r.equipmentId === machine.id);
                if (row) {
                    setView({
                        correctiveCount: row.correctiveCount,
                        partsCost: row.partsCost,
                        laborCost: (row.totalMinutes / 60) * 30,
                        totalWOs: row.totalCount
                    });
                }
            })
            .catch(err => console.warn('No se pudo cargar report_equipment_stats:', err));
        return () => { cancelled = true; };
    }, [machine.id]);

    const stats = useMemo(() => {
        const relatedWOs = workOrders.filter(wo => wo.equipmentId === machine.id);
        const failures = relatedWOs.filter(wo => wo.type === WOType.CORRECTIVE).length;

        // Material Cost
        const materialCost = relatedWOs.reduce((acc, wo) => {
            const partsCost = wo.usedParts?.reduce((pAcc, part) => {
                const item = inventory.find(i => i.id === part.partId);
                return pAcc + (item ? item.price * part.quantity : 0);
            }, 0) || 0;
            return acc + partsCost;
        }, 0);

        // Labor Cost (Est. 30€/h)
        // Labor Cost (Est. 30€/h)
        const laborHours = relatedWOs.reduce((acc, wo) => acc + getDuration(wo), 0) / 60;
        const laborCost = laborHours * 30;

        return {
            failures: view?.correctiveCount ?? failures,
            materialCost: view?.partsCost ?? materialCost,
            laborCost: view?.laborCost ?? laborCost,
            totalWOs: view?.totalWOs ?? relatedWOs.length,
            history: relatedWOs
        };
    }, [machine, workOrders, inventory, view]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-orange-600 dark:text-orange-300 text-xl font-bold">
                    <Wrench size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{machine.code ? `[${machine.code}] ` : ''}{machine.name}</h2>
                    <p className="text-slate-500">{machine.location} • {machine.serialNumber}</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Nº Fallos"
                    value={stats.failures}
                    icon={AlertCircle}
                    color="red"
                />
                <StatCard
                    title="Coste Repuestos"
                    value={`${stats.materialCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`}
                    icon={Package}
                    color="blue"
                />
                <StatCard
                    title="Coste Mano Obra"
                    value={`${stats.laborCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`}
                    icon={Users}
                    color="emerald"
                />
                <StatCard
                    title="Total Incidencias"
                    value={stats.totalWOs}
                    icon={FileText}
                    color="slate"
                />
            </div>

            {/* Breakdown History */}
            <div className="bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white">
                    Historial de Intervenciones
                </div>
                <HistoryTable
                    data={stats.history.slice(0, 10)}
                    columns={[
                        { header: 'Fecha', accessor: (wo) => new Date(wo.createdAt).toLocaleDateString() },
                        { header: 'Tipo', accessor: (wo) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${wo.type === WOType.CORRECTIVE ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{wo.type}</span> },
                        { header: 'Problema', accessor: (wo) => wo.title },
                        { header: 'Estado', accessor: (wo) => wo.status },
                        {
                            header: 'Coste Total', accessor: (wo) => {
                                const parts = (wo.usedParts?.reduce((acc: number, p: any) => {
                                    const item = inventory.find(i => i.id === p.partId);
                                    return acc + (item ? item.price * p.quantity : 0);
                                }, 0) || 0);
                                const labor = ((getDuration(wo) / 60) * 30);
                                return (parts + labor).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                            }
                        }
                    ]}
                />
            </div>
        </div>
    );
};

const InventoryDetails = ({ item, workOrders, inventory }: { item: InventoryItem, workOrders: WorkOrder[], inventory: InventoryItem[] }) => {
    const [rotation, setRotation] = useState<{ usageCount: number; totalUsedQty: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        reportService.getPartRotation()
            .then(rows => {
                if (cancelled) return;
                const row = rows.find(r => r.itemId === item.id);
                if (row) setRotation({ usageCount: row.workOrdersCount, totalUsedQty: Number(row.totalUsed) });
            })
            .catch(err => console.warn('No se pudo cargar report_part_rotation:', err));
        return () => { cancelled = true; };
    }, [item.id]);

    const stats = useMemo(() => {
        // Usage Count (how many WOs have used this part)
        const usageCount = workOrders.filter(wo => wo.usedParts?.some(p => p.partId === item.id)).length;
        const totalUsedQty = workOrders.reduce((acc, wo) => {
            const part = wo.usedParts?.find(p => p.partId === item.id);
            return acc + (part ? part.quantity : 0);
        }, 0);

        return {
            usageCount: rotation?.usageCount ?? usageCount,
            totalUsedQty: rotation?.totalUsedQty ?? totalUsedQty,
            totalValue: item.quantity * item.price
        };
    }, [item, workOrders, rotation]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-300 text-xl font-bold">
                    <Box size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{item.name}</h2>
                    <p className="text-slate-500">SKU: {item.sku} • {item.location}</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    title="Stock Actual"
                    value={`${item.quantity} un.`}
                    subtext={`Mínimo: ${item.minStock}`}
                    icon={Package}
                    color={item.quantity <= item.minStock ? "red" : "emerald"}
                />
                <StatCard
                    title="Valor Total"
                    value={`${stats.totalValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`}
                    icon={DollarSign}
                    color="amber"
                />
                <StatCard
                    title="Rotación (Uso)"
                    value={stats.totalUsedQty}
                    subtext={`En ${stats.usageCount} órdenes`}
                    icon={ArrowUpRight}
                    color="purple"
                />
            </div>

            {/* Details Table mocked for movements */}
            <div className="bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">Detalles del Ítem</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">Categoría</span>
                        <span className="font-medium text-slate-800 dark:text-white">{item.category}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">Proveedor</span>
                        <span className="font-medium text-slate-800 dark:text-white">{item.supplier}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">Precio Unitario</span>
                        <span className="font-medium text-slate-800 dark:text-white">{item.price.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-slate-500">Criticidad</span>
                        <span className={`font-medium ${item.critic === 'Alta' ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>{item.critic}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}


// Helper for accent-insensitive search
const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// --- Main Module ---

import { useAppStore } from '../store/useAppStore';

const DistributionBars = ({ title, data }: { title: string, data: { value: string, count: number }[] }) => {
    const maxCount = Math.max(...data.map(d => d.count), 0);
    return (
        <div className="bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3">{title}</h3>
            <div className="space-y-2">
                {data.map(d => (
                    <div key={d.value} className="flex items-center gap-2 text-xs">
                        <span className="w-32 truncate text-slate-500 dark:text-slate-400" title={d.value}>{d.value}</span>
                        <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${maxCount > 0 ? (d.count / maxCount) * 100 : 0}%` }}
                            />
                        </div>
                        <span className="w-8 text-right font-bold text-slate-600 dark:text-slate-300">{d.count}</span>
                    </div>
                ))}
                {data.length === 0 && <p className="text-xs text-slate-400">Sin datos</p>}
            </div>
        </div>
    );
};

const IncidentDetails = ({ category, incidents, categoryName }: { category: IncidentCategory | null, incidents: Incident[], categoryName: string }) => {
    // Los 10 KPIs salen de la vista de reporting (BD). El resto —evolución
    // mensual, distribuciones y el listado de resueltas— sigue saliendo del
    // conjunto ya filtrado, porque son consultas sobre el detalle.
    const [viewStats, setViewStats] = useState<ReturnType<typeof computeIncidentStats> | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = category
            ? reportService.getIncidentStatsByCategory().then(rows => rows.find(r => r.categoryId === category.id) || null)
            : reportService.getIncidentStats();
        load
            .then(row => {
                if (cancelled || !row) return;
                setViewStats({
                    total: row.total,
                    open: row.openCount,
                    inReview: row.inReviewCount,
                    resolved: row.resolvedCount,
                    cancelled: row.cancelledCount,
                    converted: row.convertedCount,
                    resolutionRate: row.resolutionRate,
                    avgResolutionDays: row.avgResolutionDays,
                    reasonsFilled: row.reasonsFilled,
                    solutionsFilled: row.solutionsFilled
                } as ReturnType<typeof computeIncidentStats>);
            })
            .catch(err => console.warn('No se pudo cargar las vistas de incidencias:', err));
        return () => { cancelled = true; };
    }, [category?.id]);

    const localStats = computeIncidentStats(incidents);
    const stats = viewStats ?? localStats;
    const monthly = computeMonthlySeries(incidents);
    const maxMonthly = Math.max(...monthly.map(m => m.count), 0);
    const byStatus = computeDistribution(incidents, inc => inc.status);
    const bySection = computeDistribution(incidents, inc => inc.section || '');
    const byCategory = computeDistribution(incidents, inc => inc.categoryName || '');
    const resolvedList = incidents.filter(inc => inc.status === IncidentStatus.RESOLVED);

    return (
        <div className="p-6 space-y-6 overflow-y-auto h-full custom-scrollbar">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300">
                    <AlertCircle size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{categoryName}</h2>
                    <p className="text-slate-500 text-sm">Estadísticas de incidencias en el rango seleccionado</p>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard title="Total" value={stats.total} icon={FileText} color="slate" />
                <StatCard title="Abiertas" value={stats.open} icon={AlertCircle} color="amber" />
                <StatCard title="En Revisión" value={stats.inReview} icon={Clock} color="blue" />
                <StatCard title="Resueltas" value={stats.resolved} icon={CheckCircle2} color="emerald" />
                <StatCard title="Canceladas" value={stats.cancelled} icon={FileText} color="slate" />
                <StatCard title="% Resueltas" value={`${stats.resolutionRate}%`} icon={TrendingUp} color="emerald" />
                <StatCard title="Convertidas a OT" value={stats.converted} icon={Wrench} color="purple" />
                <StatCard title="Tiempo medio resolución" value={stats.avgResolutionDays !== null ? `${stats.avgResolutionDays} d` : '—'} icon={Clock} color="blue" />
                <StatCard title="Con motivo" value={`${stats.reasonsFilled}/${stats.total}`} icon={FileText} color="blue" />
                <StatCard title="Con solución" value={`${stats.solutionsFilled}/${stats.total}`} icon={CheckCircle2} color="emerald" />
            </div>

            {/* Monthly trend */}
            <div className="bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3">Evolución mensual (últimos 12 meses)</h3>
                <div className="flex items-end gap-1.5 h-32">
                    {monthly.map(m => (
                        <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                            <span className="text-[10px] font-bold text-slate-500">{m.count > 0 ? m.count : ''}</span>
                            <div className="w-full bg-blue-600 rounded-t" style={{ height: `${maxMonthly > 0 ? Math.max((m.count / maxMonthly) * 90, m.count > 0 ? 6 : 2) : 2}%` }} />
                            <span className="text-[10px] text-slate-400 truncate w-full text-center capitalize">{m.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DistributionBars title="Por estado" data={byStatus} />
                <DistributionBars title="Por sección" data={bySection} />
                {!category && <DistributionBars title="Por categoría" data={byCategory} />}
            </div>

            {/* Resolved table with reason & solution */}
            <div className="bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-white">
                    Resueltas — motivo y solución
                </div>
                <HistoryTable
                    data={resolvedList}
                    columns={[
                        { header: 'ID', accessor: (inc: Incident) => <span className="font-mono text-xs">{inc.displayId || inc.id.slice(0, 8)}</span>, width: 'w-28' },
                        { header: 'Título', accessor: (inc: Incident) => inc.title },
                        { header: 'Motivo', accessor: (inc: Incident) => inc.reason || '—' },
                        { header: 'Solución', accessor: (inc: Incident) => inc.solution || '—' },
                        { header: 'Creada', accessor: (inc: Incident) => new Date(inc.createdAt).toLocaleDateString('es-ES') },
                        { header: 'Resuelta', accessor: (inc: Incident) => inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleDateString('es-ES') : '—' },
                        { header: 'Resuelta por', accessor: (inc: Incident) => inc.resolvedByName || '—' }
                    ]}
                />
            </div>
        </div>
    );
};

export const ReportsModule: React.FC = () => {
    const {
        workOrders,
        inventory,
        equipment,
        users,
        currentUser,
        incidents,
        incidentCategories,
        sections: catalogSections
    } = useAppStore();

    // Categorías visibles para el usuario (incluye inactivas: histórico)
    const visibleCategories = useVisibleCategories(currentUser);

    // Selection state: Entity Type + Entity ID
    const [activeType, setActiveType] = useState<EntityType>('worker');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Filter Work Orders by Date
    const filteredWOs = useMemo(() => {
        return workOrders.filter(wo => {
            if (!wo.closedAt) return !startDate && !endDate;
            const date = new Date(wo.closedAt);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;

            if (start && date < start) return false;
            if (end) {
                end.setHours(23, 59, 59); // Include the end day
                if (date > end) return false;
            }
            return true;
        });
    }, [workOrders, startDate, endDate]);

    // Filter Incidents by date (createdAt) + section scope + category visibility
    const filteredIncidents = useMemo(() => {
        const visible = incidents.filter(inc => canSeeIncident(inc, currentUser, incidentCategories, catalogSections));

        return visible.filter(inc => {
            const date = new Date(inc.createdAt);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (start && date < start) return false;
            if (end) {
                end.setHours(23, 59, 59);
                if (date > end) return false;
            }
            return true;
        });
    }, [incidents, incidentCategories, currentUser, catalogSections, startDate, endDate]);

    // CSV Export Logic
    const handleExport = () => {
        if (!selectedId) return;

        // Define data to export based on view
        let dataToExport: any[] = [];
        let headers: string[] = [];
        let filename = 'report';

        if (activeType === 'worker') {
            const worker = users.find(u => u.id === selectedId);
            if (!worker) return;
            filename = `report_worker_${worker.name.replace(/\s+/g, '_')}`;
            headers = ['ID', 'Title', 'Date', 'Time(min)', 'Status'];
            dataToExport = filteredWOs
                .filter(wo => wo.assignedUserId === selectedId && wo.status === WOStatus.COMPLETED)
                .map(wo => [wo.id, wo.title, new Date(wo.createdAt).toLocaleDateString(), getDuration(wo), wo.status]);
        } else if (activeType === 'machine') {
            const machine = equipment.find(e => e.id === selectedId);
            if (!machine) return;
            filename = `report_machine_${machine.name.replace(/\s+/g, '_')}`;
            headers = ['ID', 'Title', 'Date', 'Type', 'Status', 'Time(min)'];
            dataToExport = filteredWOs
                .filter(wo => wo.equipmentId === selectedId)
                .map(wo => [wo.id, wo.title, new Date(wo.createdAt).toLocaleDateString(), wo.type, wo.status, getDuration(wo)]);
        } else if (activeType === 'incident') {
            const cat = selectedId === 'ALL' ? null : visibleCategories.find(c => c.id === selectedId);
            filename = selectedId === 'ALL'
                ? 'report_incidencias_todas'
                : `report_incidencias_${(cat?.name || 'categoria').replace(/\s+/g, '_')}`;
            headers = ['ID', 'Titulo', 'Categoria', 'Seccion', 'Estado', 'Prioridad', 'Motivo', 'Solucion', 'Creada', 'Resuelta', 'Resuelta por'];
            const quote = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            dataToExport = filteredIncidents
                .filter(inc => selectedId === 'ALL' || inc.categoryId === selectedId)
                .map(inc => [
                    quote(inc.displayId || inc.id),
                    quote(inc.title),
                    quote(inc.categoryName || ''),
                    quote(inc.section || ''),
                    quote(inc.status),
                    quote(inc.priority),
                    quote(inc.reason || ''),
                    quote(inc.solution || ''),
                    quote(new Date(inc.createdAt).toLocaleDateString()),
                    quote(inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleDateString() : ''),
                    quote(inc.resolvedByName || '')
                ].join(','));
            // Filas ya comillas+celdas: devolvemos strings directos
            dataToExport = dataToExport.map(row => [row]);
        } else {
            const item = inventory.find(i => i.id === selectedId);
            if (!item) return;
            filename = `report_inventory_${item.sku}`;
            headers = ['WO ID', 'Date', 'Qty Used'];
            dataToExport = filteredWOs
                .filter(wo => wo.usedParts?.some(p => p.partId === selectedId))
                .map(wo => {
                    const part = wo.usedParts?.find(p => p.partId === selectedId);
                    return [wo.id, new Date(wo.createdAt).toLocaleDateString(), part?.quantity || 0];
                });
        }

        // Generate CSV Content
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(row => row.join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter personnel based on current user's role
    const filteredPersonnel = useMemo(() => {
        if (!currentUser) return [];

        if (currentUser.role === UserRole.ADMIN) {
            // Admins see Technicians and Section Managers
            return users.filter(u => u.role === UserRole.TECHNICIAN || u.role === UserRole.SECTION_MANAGER);
        } else if (currentUser.role === UserRole.SECTION_MANAGER) {
            // Section Managers see only Technicians
            return users.filter(u => u.role === UserRole.TECHNICIAN);
        }

        // For other roles (e.g. Technician/Observer), maybe they shouldn't see anyone or just themselves?
        // Usually reports are for managers/admins. If a technician accesses, show nothing or just them.
        return users.filter(u => u.id === currentUser.id);
    }, [users, currentUser]);

    // Dynamic Lists based on Type
    const listItems = useMemo(() => {
        let items: { id: string, name: string, sub?: string }[] = [];
        const normalizedSearch = normalizeText(searchTerm);

        if (activeType === 'worker') {
            items = filteredPersonnel.filter(t => normalizeText(t.name).includes(normalizedSearch))
                .map(t => ({ id: t.id, name: t.name, sub: t.role }));
        } else if (activeType === 'machine') {
            items = equipment.filter(e => normalizeText(e.name).includes(normalizedSearch) || (e.code && normalizeText(e.code).includes(normalizedSearch)))
                .map(e => ({ id: e.id, name: e.code ? `[${e.code}] ${e.name}` : e.name, sub: e.location }));
        } else if (activeType === 'inventory') {
            items = inventory.filter(i => normalizeText(i.name).includes(normalizedSearch))
                .map(i => ({ id: i.id, name: i.name, sub: `Stock: ${i.quantity}` }));
        } else if (activeType === 'incident') {
            const countByCat = (catId: string | null) =>
                filteredIncidents.filter(inc => catId === null || inc.categoryId === catId).length;
            items = [
                { id: 'ALL', name: 'Todas las categorías', sub: `${countByCat(null)} incidencias` },
                ...visibleCategories
                    .filter(c => normalizeText(c.name).includes(normalizedSearch))
                    .map(c => ({ id: c.id, name: c.name, sub: `${countByCat(c.id)} incidencias` }))
            ];
        }

        return items;
    }, [activeType, searchTerm, users, equipment, inventory, filteredIncidents, visibleCategories]);

    // Select first item by default when nothing selected or current selection is invalid
    useEffect(() => {
        const isValid = selectedId && listItems.some(item => item.id === selectedId);
        if (!isValid && listItems.length > 0) {
            setSelectedId(listItems[0].id);
        }
    }, [selectedId, listItems]);

    const renderDetailView = () => {
        if (!selectedId) return <div className="flex items-center justify-center h-full text-slate-400">Selecciona un elemento</div>;

        if (activeType === 'worker') {
            const worker = users.find(u => u.id === selectedId);
            if (worker) return <WorkerDetails worker={worker} workOrders={filteredWOs} inventory={inventory} />;
        }
        if (activeType === 'machine') {
            const machine = equipment.find(e => e.id === selectedId);
            if (machine) return <MachineDetails machine={machine} workOrders={filteredWOs} inventory={inventory} />;
        }
        if (activeType === 'inventory') {
            const item = inventory.find(i => i.id === selectedId);
            if (item) return <InventoryDetails item={item} workOrders={filteredWOs} inventory={inventory} />;
        }
        if (activeType === 'incident') {
            const cat = selectedId === 'ALL' ? null : visibleCategories.find(c => c.id === selectedId) || null;
            const scoped = selectedId === 'ALL'
                ? filteredIncidents
                : filteredIncidents.filter(inc => inc.categoryId === selectedId);
            return (
                <IncidentDetails
                    category={cat}
                    incidents={scoped}
                    categoryName={selectedId === 'ALL' ? 'Todas las categorías' : (cat?.name || 'Categoría')}
                />
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] -m-6 text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800">
            {/* Top Navigation Bar */}
            <div className="bg-white dark:bg-slate-700 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <LayoutDashboard className="text-blue-600" />
                        <h1 className="text-xl font-bold">Dashboard</h1>
                    </div>

                    {/* Date Filters */}
                    <div className="hidden md:flex items-center gap-2 text-sm bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <input
                            type="date"
                            className="bg-transparent border-none outline-none text-slate-600 dark:text-slate-300 px-2"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <span className="text-slate-400">→</span>
                        <input
                            type="date"
                            className="bg-transparent border-none outline-none text-slate-600 dark:text-slate-300 px-2"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-between">
                    {/* Entity Switcher */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        {[
                            { id: 'worker', label: 'Trabajadores', icon: Users },
                            { id: 'machine', label: 'Equipos', icon: Wrench },
                            { id: 'inventory', label: 'Repuestos', icon: Package },
                            { id: 'incident', label: 'Incidencias', icon: AlertCircle },
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => { setActiveType(type.id as EntityType); setSelectedId(null); setSearchTerm(''); }}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeType === type.id
                                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                <type.icon size={16} />
                                <span className="hidden lg:inline">{type.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={!selectedId}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Exportar datos visibles a CSV"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">Exportar</span>
                    </button>
                </div>
            </div>

            {/* Content Area (Split View) */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left Sidebar: Explorer */}
                <div className="w-80 bg-white dark:bg-slate-700 border-r border-slate-200 dark:border-slate-700 flex flex-col z-0">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder={`Buscar ${activeType === 'worker' ? 'trabajador' : activeType === 'machine' ? 'equipo' : 'repuesto'}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {listItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setSelectedId(item.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-all flex items-center justify-between group ${selectedId === item.id
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <div>
                                    <div className="font-medium">{item.name}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{item.sub}</div>
                                </div>
                                {selectedId === item.id && <ChevronRight size={16} />}
                            </button>
                        ))}
                    </div>
                    <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700">
                        {listItems.length} elementos encontrados
                    </div>
                </div>

                {/* Right Panel: Deep Dive Details */}
                <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-800 p-6 md:p-8">
                    <div className="max-w-6xl mx-auto">
                        {renderDetailView()}
                    </div>
                </div>

            </div>
        </div>
    );
};
