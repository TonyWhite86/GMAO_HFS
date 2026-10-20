import React, { useMemo } from 'react';
import { AlertCircle, ChevronRight, Clock } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { IncidentStatus } from '../../../types';
import { canSeeIncident } from '../../../utils/incidentVisibility';
import { INCIDENT_STATUS_CONFIG } from '../../../constants';

interface IncidentsPanelProps {
    onNavigate: () => void;
}

/** A1: estado de las incidencias visibles + recientes. */
export const IncidentsPanel: React.FC<IncidentsPanelProps> = ({ onNavigate }) => {
    const incidents = useAppStore(s => s.incidents);
    const incidentCategories = useAppStore(s => s.incidentCategories);
    const sections = useAppStore(s => s.sections);
    const currentUser = useAppStore(s => s.currentUser);

    const visible = useMemo(
        () => incidents.filter(i => canSeeIncident(i, currentUser, incidentCategories, sections)),
        [incidents, currentUser, incidentCategories, sections]
    );

    const active = visible.filter(i =>
        i.status !== IncidentStatus.CLOSED && i.status !== IncidentStatus.PENDING_CLOSE).length;
    const pendingClose = visible.filter(i => i.status === IncidentStatus.PENDING_CLOSE).length;
    const recent = [...visible]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <button onClick={onNavigate} className="w-full flex items-center gap-2 px-4 py-3 border-b border-line hover:bg-surface-2 transition-colors">
                <AlertCircle size={16} className="text-warn" />
                <span className="font-bold text-txt text-sm">Incidencias</span>
                <ChevronRight size={16} className="ml-auto text-txt-3" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 text-xs">
                <span className="bdg bdg-amber">{active} activas</span>
                {pendingClose > 0 && (
                    <span className="bdg bdg-purple">{pendingClose} pdtes. de confirmación</span>
                )}
            </div>
            <div className="divide-y divide-line">
                {recent.map(inc => {
                    const cfg = INCIDENT_STATUS_CONFIG[inc.status];
                    return (
                        <button key={inc.id} onClick={onNavigate} className="w-full text-left px-4 py-2 hover:bg-surface-2 transition-colors flex items-center gap-2">
                            <span className={`bdg ${cfg?.bgClass || 'bdg-gray'} shrink-0`}>{cfg?.label || inc.status}</span>
                            <span className="text-xs text-txt truncate flex-1">{inc.title}</span>
                            <span className="text-[10px] text-txt-3 whitespace-nowrap">
                                {new Date(inc.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                            </span>
                        </button>
                    );
                })}
                {recent.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-txt-3">Sin incidencias registradas</div>
                )}
            </div>
        </div>
    );
};
