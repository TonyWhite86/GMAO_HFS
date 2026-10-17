import React, { useMemo } from 'react';
import { ChevronRight, Wrench, AlertCircle, History } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { canSeeIncident } from '../../../utils/incidentVisibility';
import { getRecentActivity } from '../../../utils/dashboardStats';

interface ActivityFeedProps {
    onNavigateWo: () => void;
    onNavigateIncident: () => void;
}

const timeAgo = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    return `hace ${Math.floor(h / 24)}d`;
};

/** A5: últimos movimientos (eventos de OT + comentarios de incidencias). */
export const ActivityFeed: React.FC<ActivityFeedProps> = ({ onNavigateWo, onNavigateIncident }) => {
    const workOrders = useAppStore(s => s.workOrders);
    const incidents = useAppStore(s => s.incidents);
    const incidentCategories = useAppStore(s => s.incidentCategories);
    const sections = useAppStore(s => s.sections);
    const currentUser = useAppStore(s => s.currentUser);

    const entries = useMemo(() => {
        const visibleIncidents = incidents.filter(i => canSeeIncident(i, currentUser, incidentCategories, sections));
        return getRecentActivity(workOrders, visibleIncidents, 10);
    }, [workOrders, incidents, currentUser, incidentCategories, sections]);

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <History size={16} className="text-accent" />
                <span className="font-bold text-txt text-sm">Actividad reciente</span>
            </div>
            <div className="divide-y divide-line">
                {entries.map(e => (
                    <button
                        key={e.id}
                        onClick={e.kind === 'wo' ? onNavigateWo : onNavigateIncident}
                        className="w-full text-left px-4 py-2 hover:bg-surface-2 transition-colors flex items-center gap-2"
                    >
                        {e.kind === 'wo'
                            ? <Wrench size={13} className="text-accent shrink-0" />
                            : <AlertCircle size={13} className="text-warn shrink-0" />}
                        <div className="min-w-0 flex-1">
                            <p className="text-xs text-txt truncate">
                                <span className="font-bold">{e.actorName}</span> · {e.text}
                            </p>
                            <p className="text-[10px] text-txt-3 truncate">{e.title}</p>
                        </div>
                        <span className="text-[10px] text-txt-3 whitespace-nowrap">{timeAgo(e.createdAt)}</span>
                    </button>
                ))}
                {entries.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-txt-3">Todavía no hay movimientos.</div>
                )}
            </div>
            {(entries.length > 0) && (
                <button
                    onClick={entries[0]?.kind === 'wo' ? onNavigateWo : onNavigateIncident}
                    className="w-full px-4 py-2 text-[10px] font-bold text-accent hover:bg-accent-dim transition-colors flex items-center justify-center gap-1"
                >
                    Ver más <ChevronRight size={12} />
                </button>
            )}
        </div>
    );
};
