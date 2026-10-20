import React, { useMemo } from 'react';
import { AlertTriangle, CalendarClock, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { StoppageStatus } from '../../../types';
import { getOpenNow, getStoppageReasonLabel } from '../../../utils/stoppageFilters';

interface StoppagesPanelProps {
    onNavigate: () => void;
}

const elapsedLabel = (startAt: string): string => {
    const ms = Date.now() - new Date(startAt).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `desde hace ${h}h ${m}m` : `desde hace ${m}m`;
};

/** A2: equipos parados ahora + próximas paradas. */
export const StoppagesPanel: React.FC<StoppagesPanelProps> = ({ onNavigate }) => {
    const stoppages = useAppStore(s => s.stoppages);

    const openNow = useMemo(() => getOpenNow(stoppages), [stoppages]);
    const upcoming = useMemo(() => {
        const now = Date.now();
        return stoppages
            .filter(s => new Date(s.startAt).getTime() >= now && s.status === StoppageStatus.SCHEDULED)
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .slice(0, 5);
    }, [stoppages]);

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <button onClick={onNavigate} className="w-full flex items-center gap-2 px-4 py-3 border-b border-line hover:bg-surface-2 transition-colors">
                <CalendarClock size={16} className="text-warn" />
                <span className="font-bold text-txt text-sm">Paradas de equipo</span>
                <ChevronRight size={16} className="ml-auto text-txt-3" />
            </button>

            {openNow.length > 0 && (
                <div className="px-4 py-2 space-y-1">
                    {openNow.slice(0, 3).map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-xs">
                            <AlertTriangle size={12} className="text-warn shrink-0" />
                            <span className="font-bold text-txt truncate">{s.equipmentName || 'Equipo'}</span>
                            <span className="text-txt-2 truncate flex-1">{getStoppageReasonLabel(s)}</span>
                            <span className="text-warn font-bold whitespace-nowrap">{elapsedLabel(s.startAt)}</span>
                        </div>
                    ))}
                    {openNow.length > 3 && (
                        <button onClick={onNavigate} className="text-[10px] text-accent hover:underline">
                            Ver {openNow.length - 3} paradas más
                        </button>
                    )}
                </div>
            )}

            <div className="px-4 py-2 border-t border-line">
                <div className="text-[10px] font-bold text-txt-3 uppercase tracking-wider mb-1">Próximas programadas</div>
                {upcoming.length > 0 ? (
                    <div className="space-y-1">
                        {upcoming.map(s => (
                            <button key={s.id} onClick={onNavigate} className="w-full text-left flex items-center gap-2 text-xs hover:bg-surface-2 rounded px-1 py-0.5">
                                <span className="text-txt truncate flex-1">{s.equipmentName || 'Equipo'} · {s.title}</span>
                                <span className="text-txt-2 whitespace-nowrap">
                                    {new Date(s.startAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}{' '}
                                    {new Date(s.startAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-txt-3 py-1">Sin paradas programadas</p>
                )}
            </div>

            {openNow.length === 0 && upcoming.length === 0 && (
                <div className="px-4 py-4 text-center text-xs text-txt-3">Sin paradas activas ni programadas</div>
            )}
        </div>
    );
};
