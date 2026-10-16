import React, { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { WorkOrder, WOStatus, WOType } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { getStatusColor } from '../../../constants';

interface EquipmentWorkOrdersProps {
    equipmentId: string;
    onSelectWorkOrder: (id: string) => void;
}

export const EquipmentWorkOrders: React.FC<EquipmentWorkOrdersProps> = ({ equipmentId, onSelectWorkOrder }) => {
    const { workOrders } = useAppStore();

    const [woTab, setWoTab] = useState<'active' | 'history'>('active');
    const [woFilters, setWoFilters] = useState({
        search: '',
        userId: '',
        type: 'all' as WOType | 'all',
        startDate: '',
        endDate: ''
    });

    const relatedWOs = workOrders.filter(wo => {
        if (wo.equipmentId !== equipmentId) return false;
        const matchesSearch = wo.title.toLowerCase().includes(woFilters.search.toLowerCase()) ||
            wo.id.toLowerCase().includes(woFilters.search.toLowerCase());
        const matchesType = woFilters.type === 'all' || wo.type === woFilters.type;
        let matchesDate = true;
        if (woFilters.startDate || woFilters.endDate) {
            const woDate = new Date(wo.createdAt).getTime();
            if (woFilters.startDate && woDate < new Date(woFilters.startDate).getTime()) matchesDate = false;
            if (woFilters.endDate) {
                const end = new Date(woFilters.endDate);
                end.setHours(23, 59, 59);
                if (woDate > end.getTime()) matchesDate = false;
            }
        }
        const isCompleted = wo.status === WOStatus.COMPLETED;
        const matchesTab = woTab === 'active' ? !isCompleted : isCompleted;
        return matchesSearch && matchesType && matchesDate && matchesTab;
    });

    const typeBadge = (type: WOType) => {
        if (type === WOType.CORRECTIVE) return 'bg-accent-dim text-accent border-accent-border  text-accent ';
        if (type === WOType.PREVENTIVE) return 'bg-spec-dim text-spec border-spec-border';
        return 'bg-warn-dim text-warn border-warn-border';
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-txt">Historial</h3>

                        <div className="flex sm:hidden bg-surface-2 rounded-lg p-0.5 border border-line">
                            <button onClick={() => setWoTab('active')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'active' ? 'bg-surface  shadow-sm text-accent' : 'text-txt-2 hover:text-txt-2 '}`}>
                                Pendientes
                            </button>
                            <button onClick={() => setWoTab('history')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'history' ? 'bg-surface  shadow-sm text-accent' : 'text-txt-2 hover:text-txt-2 '}`}>
                                Histórico
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-40">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-3" size={13} />
                                <input
                                    placeholder="Buscar..."
                                    value={woFilters.search}
                                    onChange={(e) => setWoFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="w-full pl-8 pr-2 py-1 text-[11px] rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20"
                                />
                            </div>
                            <CustomSelect
                                value={woFilters.type}
                                onChange={(val) => setWoFilters(prev => ({ ...prev, type: val as WOType | 'all' }))}
                                options={[
                                    { value: 'all', label: 'Todo' },
                                    ...Object.values(WOType).map(t => ({ value: t, label: t }))
                                ]}
                                className="w-auto min-w-[100px]"
                                size="sm"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="flex items-center gap-1 flex-1">
                                <input type="date" value={woFilters.startDate} onChange={(e) => setWoFilters(prev => ({ ...prev, startDate: e.target.value }))} className="w-full sm:w-auto min-w-[90px] px-2 py-1 text-[11px] rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20" />
                                <span className="text-txt-3">-</span>
                                <input type="date" value={woFilters.endDate} onChange={(e) => setWoFilters(prev => ({ ...prev, endDate: e.target.value }))} className="w-full sm:w-auto min-w-[90px] px-2 py-1 text-[11px] rounded-md border border-line bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20" />
                            </div>

                            <div className="hidden sm:flex bg-surface-2 rounded-lg p-0.5 border border-line shrink-0">
                                <button onClick={() => setWoTab('active')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'active' ? 'bg-surface  shadow-sm text-accent' : 'text-txt-2 hover:text-txt-2 '}`}>
                                    Pendientes
                                </button>
                                <button onClick={() => setWoTab('history')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'history' ? 'bg-surface  shadow-sm text-accent' : 'text-txt-2 hover:text-txt-2 '}`}>
                                    Histórico
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {relatedWOs.length > 0 ? (
                <>
                    <div className="space-y-3 md:hidden">
                        {relatedWOs.map(wo => (
                            <div key={wo.id} onClick={() => onSelectWorkOrder(wo.id)} className="p-4 bg-surface border border-line rounded-xl shadow-sm space-y-3 active:scale-[0.98] transition-transform">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${typeBadge(wo.type)}`}>
                                            {wo.type}
                                        </span>
                                        <h4 className="font-bold text-txt line-clamp-2">{wo.title}</h4>
                                        <div className="text-xs text-txt-2">#{wo.id}</div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(wo.status)}`}>
                                        {wo.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-txt-2 pt-2 border-t border-line">
                                    <span>{new Date(wo.createdAt).toLocaleDateString()}</span>
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hidden md:block bg-surface rounded-xl shadow-sm border border-line overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-line bg-surface-2/50 bg-surface">
                                        <th className="p-3 text-xs font-semibold text-txt-2 uppercase">Título</th>
                                        <th className="p-3 text-xs font-semibold text-txt-2 uppercase">Tipo</th>
                                        <th className="p-3 text-xs font-semibold text-txt-2 uppercase">Estado</th>
                                        <th className="p-3 text-xs font-semibold text-txt-2 uppercase text-right">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {relatedWOs.map(wo => (
                                        <tr key={wo.id} onClick={() => onSelectWorkOrder(wo.id)} className="group cursor-pointer hover:bg-surface-2 transition-colors">
                                            <td className="p-3">
                                                <div className="font-medium text-txt group-hover:text-accent :text-accent transition-colors">
                                                    {wo.title}
                                                </div>
                                                <div className="text-xs text-txt-2">#{wo.id}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase border ${typeBadge(wo.type)}`}>
                                                    {wo.type}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(wo.status)}`}>
                                                    {wo.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className="text-sm text-txt-2">
                                                    {new Date(wo.createdAt).toLocaleDateString()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="text-center py-12 border border-dashed border-line rounded-xl">
                    <p className="text-txt-2 text-sm">No hay órdenes con estos filtros</p>
                </div>
            )}
        </div>
    );
};
