import React from 'react';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { ChecklistAnswer, ChecklistItem } from '../../types';

interface WOChecklistViewProps {
    items: ChecklistItem[];
    answers: Record<string, ChecklistAnswer>;
}

/** Checklist respondido, en modo lectura (OT cerrada). */
export const WOChecklistView: React.FC<WOChecklistViewProps> = ({ items, answers }) => {
    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider">
                <ClipboardCheck size={14} />
                Checklist de cierre
            </label>
            <div className="space-y-1.5">
                {items.map((item, idx) => {
                    const a: ChecklistAnswer = answers[item.id] || {};
                    return (
                        <div key={item.id} className="flex items-start gap-2 p-2 rounded-[8px] bg-surface-2 border border-line">
                            <span className="text-[10px] font-bold text-txt-3 w-5 text-right shrink-0 mt-0.5">{idx + 1}.</span>
                            <span className="text-sm text-txt flex-1">{item.text}</span>
                            {a.sel === 'si' && (
                                <span className="bdg bdg-green shrink-0"><Check size={11} /> Sí</span>
                            )}
                            {a.sel === 'no' && (
                                <span className="bdg bdg-red shrink-0"><X size={11} /> No</span>
                            )}
                            {a.val && (
                                <span className="text-xs font-mono text-txt-2 bg-surface px-2 py-0.5 rounded border border-line shrink-0">
                                    {a.val}
                                </span>
                            )}
                            {!a.sel && !a.val && (
                                <span className="bdg bdg-gray shrink-0">Sin responder</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
