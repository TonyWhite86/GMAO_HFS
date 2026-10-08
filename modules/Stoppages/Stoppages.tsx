import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { EquipmentStoppage, StoppageStatus } from '../../types';
import { ChevronLeft, ChevronRight, CalendarPlus, Calendar as CalendarIcon } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { usePermissions } from '../../hooks/usePermissions';
import { useRestrictedEquipment } from '../../hooks/useFilteredData';
import { canManageStoppage, canDeleteStoppage } from '../../utils/stoppagePermissions';
import { STOPPAGE_REASON_FALLBACK, STOPPAGE_REASON_CONFIG, STOPPAGE_STATUS_CONFIG } from '../../constants';
import { StoppageGrid } from './components/StoppageGrid';
import { StoppageFormModal } from './components/StoppageFormModal';

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfWeek = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // lunes como primer día
    return new Date(d.getTime() + diff * DAY_MS);
};

export const StoppagesModule: React.FC = () => {
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

    const upcoming = useMemo(() => {
        const now = Date.now();
        return stoppages
            .filter(s => (s.endAt ? new Date(s.endAt).getTime() : Date.now()) >= now && s.status !== StoppageStatus.CANCELLED)
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .slice(0, 10);
    }, [stoppages]);

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
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <CalendarPlus size={20} />
                            Nueva Parada
                        </button>
                    )
                }
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-700 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500 transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={() => setWeekStart(startOfWeek(new Date()))}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                        Hoy
                    </button>
                    <button
                        onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 ml-2">{weekLabel}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <CalendarIcon size={14} />
                    {weekStoppages.length} paradas esta semana
                </div>
            </div>

            {/* Grid (desktop) */}
            <div className="hidden md:block">
                <StoppageGrid
                    equipment={restrictedEquipment}
                    daysToShow={daysToShow}
                    stoppages={weekStoppages}
                    canManage={canCreateStoppages}
                    onSelectStoppage={openDetail}
                    onCreateAtSlot={(equipmentId, date) => openCreate(equipmentId, date)}
                />
            </div>

            {/* Upcoming list (mobile + resumen) */}
            <div className="bg-white dark:bg-slate-700 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white text-sm">
                    Próximas paradas
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {upcoming.map(s => {
                        const reason = (s.reasonType && STOPPAGE_REASON_CONFIG[s.reasonType]) || STOPPAGE_REASON_FALLBACK;
                        const status = STOPPAGE_STATUS_CONFIG[s.status];
                        return (
                            <button
                                key={s.id}
                                onClick={() => openDetail(s)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center gap-2"
                            >
                                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reason.bgClass}`}>
                                        {s.reasonLabel || reason.label}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.bgClass}`}>
                                        {status.label}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-white truncate">{s.title}</span>
                                    <span className="text-xs text-slate-400 truncate">{s.equipmentName}</span>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    {new Date(s.startAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}{' '}
                                    {new Date(s.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} —{' '}
                                    {s.endAt
                                        ? new Date(s.endAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                                        : <span className="text-amber-600 dark:text-amber-400 font-bold">En curso</span>}
                                </span>
                            </button>
                        );
                    })}
                    {upcoming.length === 0 && (
                        <div className="p-6 text-center text-sm text-slate-400">No hay paradas programadas</div>
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
