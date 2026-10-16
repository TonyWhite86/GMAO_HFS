import React from 'react';
import { Equipment, EquipmentStoppage, StoppageStatus } from '../../../types';
import { STOPPAGE_REASON_CONFIG, STOPPAGE_REASON_FALLBACK, STOPPAGE_STATUS_CONFIG } from '../../../constants';
import { Plus } from 'lucide-react';

interface StoppageGridProps {
    equipment: Equipment[];
    daysToShow: Date[];
    stoppages: EquipmentStoppage[];
    canManage: boolean;
    onSelectStoppage: (stoppage: EquipmentStoppage) => void;
    onCreateAtSlot: (equipmentId: string, date: Date) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Una parada abierta (end_at NULL) se dibuja hasta "ahora": es lo que lleva
// parado el equipo, y se recalcula sola según pasa el tiempo.
const stoppageEndMs = (s: EquipmentStoppage) =>
    s.endAt ? new Date(s.endAt).getTime() : Date.now();

const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const StoppageGrid: React.FC<StoppageGridProps> = ({
    equipment, daysToShow, stoppages, canManage, onSelectStoppage, onCreateAtSlot
}) => {
    const weekStart = new Date(daysToShow[0]);
    weekStart.setHours(0, 0, 0, 0);
    const totalDays = daysToShow.length;

    const dayIndexOf = (iso: string) => {
        const d = new Date(iso);
        return Math.floor((d.getTime() - weekStart.getTime()) / DAY_MS);
    };

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            {/* Header days */}
            <div className="grid border-b border-line bg-surface-2/50 bg-surface/30" style={{ gridTemplateColumns: `200px repeat(${totalDays}, 1fr)` }}>
                <div className="p-3 text-[10px] font-bold text-txt-3 uppercase tracking-widest">Equipo</div>
                {daysToShow.map(day => (
                    <div
                        key={day.toISOString()}
                        className={`p-3 text-center text-xs font-bold border-l border-line ${isSameDay(day, new Date()) ? 'text-accent bg-accent-dim/50 ' : 'text-txt-2'}`}
                    >
                        {day.toLocaleDateString('es-ES', { weekday: 'short' })}
                        <span className="block text-[10px] font-normal">
                            {day.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                        </span>
                    </div>
                ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-line max-h-[60vh] overflow-y-auto custom-scrollbar">
                {equipment.map(eq => {
                    const eqStoppages = stoppages.filter(s => s.equipmentId === eq.id);
                    return (
                        <div key={eq.id} className="relative grid items-stretch" style={{ gridTemplateColumns: `200px repeat(${totalDays}, 1fr)` }}>
                            <div className="p-3 flex items-center gap-2 min-w-0">
                                <span className="text-sm font-bold text-txt truncate" title={eq.name}>
                                    {eq.code ? `[${eq.code}] ` : ''}{eq.name}
                                </span>
                            </div>
                            {daysToShow.map((day, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => canManage && onCreateAtSlot(eq.id, day)}
                                    disabled={!canManage}
                                    className={`relative border-l border-line min-h-[64px] group ${isSameDay(day, new Date()) ? 'bg-accent-dim/30 ' : ''} ${canManage ? 'hover:bg-accent-dim/60  cursor-pointer' : ''}`}
                                    title={canManage ? 'Programar parada en esta fecha' : undefined}
                                >
                                    {canManage && (
                                        <span className="absolute inset-0 hidden group-hover:flex items-center justify-center text-accent">
                                            <Plus size={16} />
                                        </span>
                                    )}
                                </button>
                            ))}
                            {eqStoppages.map(s => {
                                const startIdx = Math.max(0, dayIndexOf(s.startAt));
                                const endIdx = Math.min(totalDays - 1, dayIndexOf(new Date(stoppageEndMs(s) - 1000).toISOString()));
                                if (endIdx < 0 || startIdx > totalDays - 1 || endIdx < startIdx) return null;
                                const leftPct = (startIdx / totalDays) * 100;
                                const widthPct = ((endIdx - startIdx + 1) / totalDays) * 100;
                                const reason = (s.reasonType && STOPPAGE_REASON_CONFIG[s.reasonType]) || STOPPAGE_REASON_FALLBACK;
                                const status = STOPPAGE_STATUS_CONFIG[s.status];
                                const cancelled = s.status === StoppageStatus.CANCELLED;
                                const completed = s.status === StoppageStatus.COMPLETED;
                                const open = !s.endAt;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={(e) => { e.stopPropagation(); onSelectStoppage(s); }}
                                        className={`pointer-events-auto absolute h-8 rounded-lg px-2 flex items-center gap-1.5 text-[11px] font-bold shadow-sm border transition-all hover:scale-[1.02] z-10 overflow-hidden ${reason.bgClass} ${cancelled ? 'opacity-50 line-through' : ''} ${completed ? 'opacity-80' : ''}`}
                                        style={{
                                            left: `calc(200px + (100% - 200px) * ${leftPct / 100})`,
                                            width: `calc((100% - 200px) * ${widthPct / 100} - 4px)`,
                                            top: '50%',
                                            transform: 'translateY(-50%)'
                                        }}
                                        title={`${s.title} (${status.label})${open ? ' · en curso desde el ' + new Date(s.startAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}`}
                                    >
                                        <span className="truncate">{s.title}</span>
                                        {open && (
                                            <span className="ml-1 shrink-0 w-2 h-2 rounded-full bg-warn animate-pulse" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
                {equipment.length === 0 && (
                    <div className="p-8 text-center text-sm text-txt-3">No hay equipos</div>
                )}
            </div>
        </div>
    );
};
