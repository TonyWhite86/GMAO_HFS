import React, { useMemo } from 'react';
import { AlertCircle, CalendarClock, Package, RefreshCw, ChevronRight, Bell } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { IncidentStatus } from '../../../types';
import { canSeeIncident } from '../../../utils/incidentVisibility';
import { getOpenNow } from '../../../utils/stoppageFilters';
import { getPreventiveSummary } from '../../../utils/dashboardStats';

interface AlertsSummaryProps {
    onNavigateIncidents: () => void;
    onNavigateStoppages: () => void;
    onNavigateInventory: () => void;
    onNavigateMaintenance: () => void;
}

interface AlertRow {
    id: string;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
    label: string;
    count: number;
    tone: 'warn' | 'ko' | 'accent';
    onClick: () => void;
}

/** Resumen único de alertas: incidencias, paradas, stock y preventivos. */
export const AlertsSummary: React.FC<AlertsSummaryProps> = ({
    onNavigateIncidents, onNavigateStoppages, onNavigateInventory, onNavigateMaintenance
}) => {
    const incidents = useAppStore(s => s.incidents);
    const incidentCategories = useAppStore(s => s.incidentCategories);
    const sections = useAppStore(s => s.sections);
    const currentUser = useAppStore(s => s.currentUser);
    const stoppages = useAppStore(s => s.stoppages);
    const inventory = useAppStore(s => s.inventory);
    const preventivePlans = useAppStore(s => s.preventivePlans);

    const rows = useMemo<AlertRow[]>(() => {
        const visibleIncidents = incidents.filter(i => canSeeIncident(i, currentUser, incidentCategories, sections));
        const pendingClose = visibleIncidents.filter(i => i.status === IncidentStatus.PENDING_CLOSE).length;
        const openIncidents = visibleIncidents.filter(i =>
            i.status !== IncidentStatus.CLOSED && i.status !== IncidentStatus.PENDING_CLOSE).length;
        const stopped = getOpenNow(stoppages).length;
        const lowStock = inventory.filter(i => i.status === 'Active' && i.quantity <= i.minStock).length;
        const overduePlans = getPreventiveSummary(preventivePlans).overdue;

        return [
            { id: 'inc', icon: AlertCircle, label: `Incidencias abiertas`, count: openIncidents, tone: 'warn', onClick: onNavigateIncidents },
            { id: 'inc-close', icon: AlertCircle, label: `Cierres pendientes de confirmar`, count: pendingClose, tone: 'ko', onClick: onNavigateIncidents },
            { id: 'stop', icon: CalendarClock, label: `Equipos parados ahora`, count: stopped, tone: 'ko', onClick: onNavigateStoppages },
            { id: 'stock', icon: Package, label: `Stock bajo`, count: lowStock, tone: 'warn', onClick: onNavigateInventory },
            { id: 'plans', icon: RefreshCw, label: `Preventivos vencidos`, count: overduePlans, tone: 'ko', onClick: onNavigateMaintenance }
        ];
    }, [incidents, currentUser, incidentCategories, sections, stoppages, inventory, preventivePlans,
        onNavigateIncidents, onNavigateStoppages, onNavigateInventory, onNavigateMaintenance]);

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <Bell size={16} className="text-warn" />
                <span className="font-bold text-txt text-sm">Alertas</span>
            </div>
            <div className="divide-y divide-line">
                {rows.map(r => {
                    const Icon = r.icon;
                    return (
                        <button
                            key={r.id}
                            onClick={r.onClick}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
                        >
                            <Icon size={15} className={r.tone === 'ko' ? 'text-ko' : r.tone === 'warn' ? 'text-warn' : 'text-accent'} />
                            <span className="text-xs text-txt truncate flex-1">{r.label}</span>
                            {r.count > 0 ? (
                                <span className={`bdg ${r.tone === 'ko' ? 'bdg-red' : 'bdg-amber'}`}>{r.count}</span>
                            ) : (
                                <span className="text-[10px] text-txt-3">—</span>
                            )}
                            <ChevronRight size={14} className="text-txt-3 shrink-0" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
