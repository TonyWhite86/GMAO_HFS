import React, { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { EquipmentStoppage, StoppageStatus } from '../../types';
import { ChevronLeft, ChevronRight, CalendarPlus, Calendar as CalendarIcon, Search, X, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { usePermissions } from '../../hooks/usePermissions';
import { useRestrictedEquipment } from '../../hooks/useFilteredData';
import { canManageStoppage, canDeleteStoppage } from '../../utils/stoppagePermissions';
import { STOPPAGE_REASON_FALLBACK, STOPPAGE_REASON_CONFIG, STOPPAGE_STATUS_CONFIG } from '../../constants';
import { StoppageGrid } from './components/StoppageGrid';
import { StoppageFormModal } from './components/StoppageFormModal';
import { CustomSelect } from '../../components/ui/CustomSelect';
import {
    EMPTY_STOPPAGE_FILTERS, StoppageFilters, filterStoppages, getOpenNow,
    getReasonOptions, getStoppageReasonLabel, hasActiveFilters, isOpenNow
} from '../../utils/stoppageFilters';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfWeek = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // lunes como primer día
    return new Date(d.getTime() + diff * DAY_MS);
};

const elapsedLabel = (startAt: string): string => {
    const ms = Date.now() - new Date(startAt).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `desde hace ${h}h ${m}m`;
    return `desde hace ${m}m`;
};

interface StoppagesModuleProps {
    initialCreate?: boolean;
    onCreateHandled?: () => void;
}

export const StoppagesModule: React.FC<StoppagesModuleProps> = ({ initialCreate, onCreateHandled }) => {
    const {
        stoppages, equipment, currentUser,
        addStoppage, updateStoppage, deleteStoppage
    } = useAppStore();
    const { canCreateStoppages } = usePermissions(currentUser);
    const restrictedEquipment = useRestrictedEquipment(equipment, currentUser);

    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStoppage, setEditingStoppage] = useState<EquipmentStoppage | null>(null);
    const [initialEquipmentId, setInitialEquipmentId] = useState<string | undefined>();
    const [initialStartAt, setInitialStartAt] = useState<string | undefined>();
    const [filters, setFilters] = useState<StoppageFilters>(EMPTY_STOPPAGE_FILTERS);

    useEffect(() => {
        if (initialCreate) {
            openCreate();
            onCreateHandled?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCreate]);

    const setFilter = <K extends keyof StoppageFilters>(key: K, value: StoppageFilters[K]) =>
        setFilters(prev => ({ ...prev, [key]: value }));

    const daysToShow = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
    }, [weekStart]);

    const weekEnd = useMemo(() => new Date(weekStart.getTime() + 7 * DAY_MS), [weekStart]);

    const weekStoppages = useMemo(() => {
        return stoppages.filter(s => {
            const start = new Date(s.startAt).getTime();
            const end = s.endAt ? new Date(s.endAt).getTime() : Date.now();
            return end >= weekStart.getTime() && start < weekEnd.getTime();
        });
    }, [stoppages, weekStart, weekEnd]);

    const filteredWeekStoppages = useMemo(
        () => filterStoppages(weekStoppages, filters),
        [weekStoppages, filters]
    );

    const openNow = useMemo(() => getOpenNow(stoppages), [stoppages]);

    const upcoming = useMemo(() => {
        const now = Date.now();
        const matching = filterStoppages(
            stoppages.filter(s => (s.endAt ? new Date(s.endAt).getTime() : Date.now()) >= now && s.status !== StoppageStatus.CANCELLED),
            filters
        ).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        // Sin filtros, recorte a las 10 próximas; con filtros, todas las coincidentes.
        return hasActiveFilters(filters) ? matching : matching.slice(0, 10);
    }, [stoppages, filters]);

    const gridEquipment = useMemo(() => {
        let eqs = restrictedEquipment;
        if (filters.equipmentId) {
            eqs = eqs.filter(e => e.id === filters.equipmentId);
        }
        if (filters.onlyOpenNow) {
            const openEqIds = new Set(openNow.map(s => s.equipmentId));
            eqs = eqs.filter(e => openEqIds.has(e.id));
        }
        return eqs;
    }, [restrictedEquipment, filters.equipmentId, filters.onlyOpenNow, openNow]);

    const reasonOptions = useMemo(
        () => getReasonOptions(stoppages).map(r => ({ value: r, label: r })),
        [stoppages]
    );

    const filtersActive = hasActiveFilters(filters);

    const openCreate = (equipmentId?: string, date?: Date) => {
        setEditingStoppage(null);
        setInitialEquipmentId(equipmentId);
        setInitialStartAt(date ? new Date(date).toISOString() : undefined);
        setIsModalOpen(true);
    };

    const openDetail = (stoppage: EquipmentStoppage) => {
        setEditingStoppage(stoppage);
        setInitialEquipmentId(undefined);
        setInitialStartAt(undefined);
        setIsModalOpen(true);
    };

    const weekLabel = `${weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${new Date(weekEnd.getTime() - DAY_MS).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Paradas Programadas"
                subtitle="Planificación de paros de máquina por mejora, mantenimiento o intervención de terceros."
                actions={
                    canCreateStoppages && (
                        <button
                            onClick={() => openCreate()}
                            className="w-full sm:w-auto btn btn-primary text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <CalendarPlus size={20} />
                            Nueva Parada
                        </button>
                    )
                }
            />

            {/* Panel: equipos parados ahora */}
            {openNow.length > 0 && (
                <div className="bg-warn-dim border border-warn-border rounded-2xl overflow-hidden">
                    <button
                        onClick={() => setFilter('onlyOpenNow', !filters.onlyOpenNow)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:brightness-[0.98] transition-all"
                    >
                        <AlertTriangle size={16} className="text-warn shrink-0" />
                        <span className="font-bold text-warn text-sm">
                            Parados ahora · {openNow.length}
                        </span>
                        <span className="text-xs text-txt-2 ml-auto">
                            {filters.onlyOpenNow ? 'Quitar filtro' : 'Ver solo estos'}
                        </span>
                    </button>
                    <div className="divide-y divide-warn-border border-t border-warn-border">
                        {openNow.map(s => (
                            <button
                                key={s.id}
                                onClick={() => openDetail(s)}
                                className="w-full text-left px-4 py-2 hover:bg-surface-2/50 transition-colors flex flex-wrap items-center gap-2"
                            >
                                <span className="font-bold text-txt text-sm truncate">{s.equipmentName || 'Equipo'}</span>
                                <span className="text-xs text-txt-2 truncate">{s.title}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-txt-2 border border-line">
                                    {getStoppageReasonLabel(s)}
                                </span>
                                <span className="text-xs text-warn font-bold ml-auto whitespace-nowrap">
                                    {elapsedLabel(s.startAt)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between bg-surface p-3 rounded-2xl border border-line shadow-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}
                        className="p-2 rounded-lg hover:bg-surface-2 text-txt-2 transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={() => setWeekStart(startOfWeek(new Date()))}
                        className="px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-dim rounded-lg transition-colors"
                    >
                        Hoy
                    </button>
                    <button
                        onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}
                        className="p-2 rounded-lg hover:bg-surface-2 text-txt-2 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <span className="text-sm font-bold text-txt-2 ml-2">{weekLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-txt-3">
                    <CalendarIcon size={14} />
                    {filtersActive
                        ? `${filteredWeekStoppages.length} de ${weekStoppages.length} paradas esta semana`
                        : `${weekStoppages.length} paradas esta semana`}
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-surface p-3 rounded-2xl border border-line shadow-sm space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full sm:w-52">
                        <CustomSelect
                            label="Equipo"
                            value={filters.equipmentId}
                            onChange={(val) => setFilter('equipmentId', val)}
                            options={[
                                { value: '', label: 'Todos los equipos' },
                                ...restrictedEquipment
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                                    .map(e => ({ value: e.id, label: e.name }))
                            ]}
                        />
                    </div>
                    <div className="w-full sm:w-44">
                        <CustomSelect
                            label="Estado"
                            value={filters.status}
                            onChange={(val) => setFilter('status', val)}
                            options={[
                                { value: '', label: 'Todos' },
                                ...Object.values(StoppageStatus).map(s => ({ value: s, label: s }))
                            ]}
                        />
                    </div>
                    <div className="w-full sm:w-52">
                        <CustomSelect
                            label="Motivo"
                            value={filters.reason}
                            onChange={(val) => setFilter('reason', val)}
                            options={[
                                { value: '', label: 'Todos' },
                                ...reasonOptions
                            ]}
                        />
                    </div>
                    <div className="w-full sm:w-48">
                        <CustomSelect
                            label="Origen"
                            value={filters.origin}
                            onChange={(val) => setFilter('origin', val as StoppageFilters['origin'])}
                            options={[
                                { value: '', label: 'Todos' },
                                { value: 'incident', label: 'De incidencia' },
                                { value: 'manual', label: 'Planificadas' }
                            ]}
                        />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-sm font-medium text-txt-2 mb-2">Buscar</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={16} />
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilter('search', e.target.value)}
                                placeholder="Título o descripción…"
                                className="fld-input w-full pl-9 pr-3 py-2.5 rounded-[6px] outline-none"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setFilter('onlyOpenNow', !filters.onlyOpenNow)}
                        className={`px-3 py-2 rounded-[6px] text-xs font-bold border transition-colors whitespace-nowrap ${filters.onlyOpenNow
                            ? 'bg-warn text-white border-warn'
                            : 'bg-surface text-txt-2 border-line hover:bg-surface-2'
                            }`}
                    >
                        Solo parados ahora
                    </button>
                </div>

                {/* Chips de filtros activos */}
                {filtersActive && (
                    <div className="flex flex-wrap items-center gap-2">
                        {filters.equipmentId && (
                            <span className="bdg bdg-accent">
                                Equipo: {restrictedEquipment.find(e => e.id === filters.equipmentId)?.name || filters.equipmentId}
                                <button onClick={() => setFilter('equipmentId', '')} className="ml-1"><X size={11} /></button>
                            </span>
                        )}
                        {filters.status && (
                            <span className="bdg bdg-accent">
                                Estado: {filters.status}
                                <button onClick={() => setFilter('status', '')} className="ml-1"><X size={11} /></button>
                            </span>
                        )}
                        {filters.onlyOpenNow && (
                            <span className="bdg bdg-amber">
                                Solo parados ahora
                                <button onClick={() => setFilter('onlyOpenNow', false)} className="ml-1"><X size={11} /></button>
                            </span>
                        )}
                        {filters.reason && (
                            <span className="bdg bdg-accent">
                                Motivo: {filters.reason}
                                <button onClick={() => setFilter('reason', '')} className="ml-1"><X size={11} /></button>
                            </span>
                        )}
                        {filters.origin && (
                            <span className="bdg bdg-accent">
                                Origen: {filters.origin === 'incident' ? 'De incidencia' : 'Planificadas'}
                                <button onClick={() => setFilter('origin', '')} className="ml-1"><X size={11} /></button>
                            </span>
                        )}
                        {filters.search.trim() && (
                            <span className="bdg bdg-accent">
                                Buscar: “{filters.search.trim()}”
                                <button onClick={() => setFilter('search', '')} className="ml-1"><X size={11} /></button>
                            </span>
                        )}
                        <button
                            onClick={() => setFilters(EMPTY_STOPPAGE_FILTERS)}
                            className="btn btn-ghost btn-sm"
                        >
                            Limpiar
                        </button>
                    </div>
                )}
            </div>

            {/* Grid (desktop) */}
            <div className="hidden md:block">
                <StoppageGrid
                    equipment={gridEquipment}
                    daysToShow={daysToShow}
                    stoppages={filteredWeekStoppages}
                    canManage={canCreateStoppages}
                    onSelectStoppage={openDetail}
                    onCreateAtSlot={(equipmentId, date) => openCreate(equipmentId, date)}
                />
            </div>

            {/* Upcoming list (mobile + resumen) */}
            <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-line font-bold text-txt text-sm">
                    {filtersActive ? 'Paradas que coinciden' : 'Próximas paradas'}
                </div>
                <div className="divide-y divide-line">
                    {upcoming.map(s => {
                        const reason = (s.reasonType && STOPPAGE_REASON_CONFIG[s.reasonType]) || STOPPAGE_REASON_FALLBACK;
                        const status = STOPPAGE_STATUS_CONFIG[s.status];
                        return (
                            <button
                                key={s.id}
                                onClick={() => openDetail(s)}
                                className="w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors flex flex-col sm:flex-row sm:items-center gap-2"
                            >
                                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reason.bgClass}`}>
                                        {getStoppageReasonLabel(s)}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.bgClass}`}>
                                        {status.label}
                                    </span>
                                    <span className="font-bold text-txt truncate">{s.title}</span>
                                    <span className="text-xs text-txt-3 truncate">{s.equipmentName}</span>
                                </div>
                                <span className="text-xs text-txt-2 whitespace-nowrap">
                                    {new Date(s.startAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}{' '}
                                    {new Date(s.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} —{' '}
                                    {s.endAt
                                        ? new Date(s.endAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                                        : <span className="text-warn font-bold">En curso</span>}
                                </span>
                            </button>
                        );
                    })}
                    {upcoming.length === 0 && (
                        <div className="p-6 text-center text-sm text-txt-3">
                            {filtersActive ? 'Ninguna parada coincide con los filtros' : 'No hay paradas programadas'}
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
            <StoppageFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                stoppage={editingStoppage}
                equipment={restrictedEquipment}
                currentUser={currentUser}
                canManage={editingStoppage ? canManageStoppage(editingStoppage, currentUser) : true}
                canDelete={editingStoppage ? canDeleteStoppage(editingStoppage, currentUser) : false}
                initialEquipmentId={initialEquipmentId}
                initialStartAt={initialStartAt}
                onCreate={addStoppage}
                onUpdate={updateStoppage}
                onDelete={deleteStoppage}
            />
            )}
        </div>
    );
};
