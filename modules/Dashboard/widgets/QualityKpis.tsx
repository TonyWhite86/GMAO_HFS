import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Clock, ClipboardCheck, CalendarClock } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { reportService } from '../../../services/reportService';
import {
    computeOnTimePct, computeChecklistPct, computePreventivePct
} from '../../../utils/dashboardStats';

interface QualityKpisProps {
    onNavigateReports: () => void;
}

const Metric: React.FC<{
    label: string;
    value: number | null;
    icon: React.ComponentType<{ size?: number | string }>;
    tone: 'ok' | 'warn' | 'ko';
}> = ({ label, value, icon: Icon, tone }) => {
    const bar = value ?? 0;
    const toneColor = tone === 'ok' ? 'var(--green)' : tone === 'warn' ? 'var(--amber)' : 'var(--red)';
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-txt-2">
                    <Icon size={13} />
                    {label}
                </span>
                <span className="font-bold text-txt">{value !== null ? `${value}%` : '—'}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${bar}%`, background: toneColor }}
                />
            </div>
        </div>
    );
};

/** B2: KPIs de calidad (plazos, checklists, preventivos, resolución de incidencias). */
export const QualityKpis: React.FC<QualityKpisProps> = ({ onNavigateReports }) => {
    const workOrders = useAppStore(s => s.workOrders);
    const preventivePlans = useAppStore(s => s.preventivePlans);
    const [avgResolutionDays, setAvgResolutionDays] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        reportService.getIncidentStats()
            .then(row => { if (!cancelled) setAvgResolutionDays(row?.avgResolutionDays ?? null); })
            .catch(() => { /* informes no disponibles: se muestra "—" */ });
        return () => { cancelled = true; };
    }, []);

    const onTime = useMemo(() => computeOnTimePct(workOrders), [workOrders]);
    const checklist = useMemo(() => computeChecklistPct(workOrders), [workOrders]);
    const preventive = useMemo(() => computePreventivePct(preventivePlans), [preventivePlans]);

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <button onClick={onNavigateReports} className="w-full flex items-center gap-2 px-4 py-3 border-b border-line hover:bg-surface-2 transition-colors">
                <TrendingUp size={16} className="text-ok" />
                <span className="font-bold text-txt text-sm">Calidad y cumplimiento</span>
            </button>
            <div className="p-4 space-y-3">
                <Metric label="OTs en plazo" value={onTime} icon={Clock} tone={(onTime ?? 0) >= 80 ? 'ok' : (onTime ?? 0) >= 60 ? 'warn' : 'ko'} />
                <Metric label="Checklists completos" value={checklist} icon={ClipboardCheck} tone={(checklist ?? 0) >= 90 ? 'ok' : (checklist ?? 0) >= 70 ? 'warn' : 'ko'} />
                <Metric label="Preventivos al día" value={preventive} icon={CalendarClock} tone={(preventive ?? 0) >= 90 ? 'ok' : (preventive ?? 0) >= 70 ? 'warn' : 'ko'} />
                <div className="flex items-center justify-between text-xs pt-1 border-t border-line">
                    <span className="text-txt-2">Tiempo medio de resolución de incidencias</span>
                    <span className="font-bold text-txt">
                        {avgResolutionDays !== null ? `${avgResolutionDays} días` : '—'}
                    </span>
                </div>
            </div>
        </div>
    );
};
