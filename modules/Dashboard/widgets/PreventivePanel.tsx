import React, { useMemo } from 'react';
import { CalendarClock, ChevronRight, AlertTriangle, Timer } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { getPreventiveSummary } from '../../../utils/dashboardStats';

interface PreventivePanelProps {
    onNavigate: () => void;
}

/** A3: preventivos vencidos / esta semana / próxima generación. */
export const PreventivePanel: React.FC<PreventivePanelProps> = ({ onNavigate }) => {
    const preventivePlans = useAppStore(s => s.preventivePlans);
    const summary = useMemo(() => getPreventiveSummary(preventivePlans), [preventivePlans]);

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <button onClick={onNavigate} className="w-full flex items-center gap-2 px-4 py-3 border-b border-line hover:bg-surface-2 transition-colors">
                <CalendarClock size={16} className="text-spec" />
                <span className="font-bold text-txt text-sm">Preventivos</span>
                <ChevronRight size={16} className="ml-auto text-txt-3" />
            </button>
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <span className={`bdg ${summary.overdue > 0 ? 'bdg-red' : 'bdg-gray'}`}>
                        {summary.overdue} vencidos
                    </span>
                    <span className="bdg bdg-amber">{summary.thisWeek} esta semana</span>
                </div>

                {summary.overdue > 0 && (
                    <div className="flex items-center gap-2 text-xs text-ko">
                        <AlertTriangle size={13} className="shrink-0" />
                        Hay planes cuya fecha de ejecución ya ha pasado.
                    </div>
                )}

                {summary.next && (
                    <div className="flex items-center gap-2 text-xs p-2 rounded-[8px] bg-surface-2 border border-line">
                        <Timer size={13} className="text-spec shrink-0" />
                        <span className="text-txt truncate flex-1">{summary.next.name}</span>
                        <span className="text-txt-2 whitespace-nowrap">
                            {new Date(summary.next.nextRun).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                        </span>
                    </div>
                )}

                {preventivePlans.length === 0 && (
                    <p className="text-xs text-txt-3">Sin planes preventivos configurados.</p>
                )}
            </div>
        </div>
    );
};
