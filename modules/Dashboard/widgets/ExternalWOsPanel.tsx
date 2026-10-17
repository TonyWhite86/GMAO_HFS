import React, { useMemo } from 'react';
import { Building2, ChevronRight, Wrench } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { getExternalWoSummary } from '../../../utils/dashboardStats';

interface ExternalWOsPanelProps {
    onNavigate: () => void;
}

/** A4: OTs externas (contratas) en curso e importe acumulado. */
export const ExternalWOsPanel: React.FC<ExternalWOsPanelProps> = ({ onNavigate }) => {
    const workOrders = useAppStore(s => s.workOrders);
    const { open, totalPrice } = useMemo(() => getExternalWoSummary(workOrders), [workOrders]);

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            <button onClick={onNavigate} className="w-full flex items-center gap-2 px-4 py-3 border-b border-line hover:bg-surface-2 transition-colors">
                <Building2 size={16} className="text-spec" />
                <span className="font-bold text-txt text-sm">OTs Externas</span>
                <ChevronRight size={16} className="ml-auto text-txt-3" />
            </button>
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="bdg bdg-purple">{open.length} en curso</span>
                    <span className="font-bold text-txt">
                        {totalPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </span>
                </div>
                {open.slice(0, 4).map(wo => (
                    <button key={wo.id} onClick={onNavigate} className="w-full text-left flex items-center gap-2 text-xs p-2 rounded-[8px] hover:bg-surface-2 transition-colors">
                        <Wrench size={12} className="text-txt-3 shrink-0" />
                        <span className="text-txt truncate flex-1">{wo.title}</span>
                        <span className="text-txt-2 whitespace-nowrap">
                            {wo.contractorName || 'Contrata'}
                            {wo.externalPrice != null ? ` · ${wo.externalPrice.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : ''}
                        </span>
                    </button>
                ))}
                {open.length === 0 && (
                    <p className="text-xs text-txt-3">Sin OTs externas en curso.</p>
                )}
            </div>
        </div>
    );
};
