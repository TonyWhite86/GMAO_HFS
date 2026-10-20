import React from 'react';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { ChecklistAnswer, ChecklistItem } from '../../types';

export const isAnswered = (a?: ChecklistAnswer): boolean =>
    !!a && ((a.sel === 'si' || a.sel === 'no') || !!(a.val && a.val.trim()));

export const isChecklistComplete = (
    items: ChecklistItem[],
    answers: Record<string, ChecklistAnswer>
): boolean => items.every(it => isAnswered(answers[it.id]));

interface WOChecklistCompleteProps {
    items: ChecklistItem[];
    answers: Record<string, ChecklistAnswer>;
    onChange: (answers: Record<string, ChecklistAnswer>) => void;
}

export const WOChecklistComplete: React.FC<WOChecklistCompleteProps> = ({ items, answers, onChange }) => {
    const answeredCount = items.filter(it => isAnswered(answers[it.id])).length;

    const setAnswer = (id: string, patch: Partial<ChecklistAnswer>) => {
        onChange({ ...answers, [id]: { ...answers[id], ...patch } });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider">
                    <ClipboardCheck size={14} />
                    Checklist de cierre
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${answeredCount === items.length ? 'bdg-green' : 'bdg-amber'} bdg`}>
                    {answeredCount} de {items.length} respondidos
                </span>
            </div>

            <div className="space-y-2">
                {items.map((item, idx) => {
                    const a = answers[item.id] || {};
                    return (
                        <div key={item.id} className="p-2.5 rounded-[10px] border border-line bg-surface-2 space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold text-txt-3 w-5 text-right shrink-0 mt-0.5">{idx + 1}.</span>
                                <span className="text-sm text-txt flex-1">{item.text}</span>
                            </div>
                            <div className="flex items-center gap-2 pl-7">
                                <button
                                    type="button"
                                    onClick={() => setAnswer(item.id, { sel: a.sel === 'si' ? null : 'si' })}
                                    className={`px-2.5 py-1 rounded-[6px] text-xs font-bold border transition-colors flex items-center gap-1 ${a.sel === 'si'
                                        ? 'bg-ok text-white border-ok'
                                        : 'bg-surface text-txt-2 border-line hover:bg-ok-dim'
                                        }`}
                                >
                                    <Check size={12} />
                                    Sí
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAnswer(item.id, { sel: a.sel === 'no' ? null : 'no' })}
                                    className={`px-2.5 py-1 rounded-[6px] text-xs font-bold border transition-colors flex items-center gap-1 ${a.sel === 'no'
                                        ? 'bg-ko text-white border-ko'
                                        : 'bg-surface text-txt-2 border-line hover:bg-ko-dim'
                                        }`}
                                >
                                    <X size={12} />
                                    No
                                </button>
                                <input
                                    type="text"
                                    value={a.val || ''}
                                    onChange={(e) => setAnswer(item.id, { val: e.target.value })}
                                    placeholder="Valor / comentario…"
                                    className="fld-input flex-1 min-w-0 px-2.5 py-1 rounded-[6px] outline-none text-xs"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
