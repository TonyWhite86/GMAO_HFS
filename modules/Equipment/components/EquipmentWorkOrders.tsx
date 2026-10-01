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
        if (type === WOType.CORRECTIVE) return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40';
        if (type === WOType.PREVENTIVE) return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/40';
        return 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/40';
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-white">Historial</h3>

                        <div className="flex sm:hidden bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 border border-slate-200 dark:border-slate-600">
                            <button onClick={() => setWoTab('active')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'active' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                                Pendientes
                            </button>
                            <button onClick={() => setWoTab('history')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'history' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                                Histórico
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-40">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                <input
                                    placeholder="Buscar..."
                                    value={woFilters.search}
                                    onChange={(e) => setWoFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="w-full pl-8 pr-2 py-1 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                                <input type="date" value={woFilters.startDate} onChange={(e) => setWoFilters(prev => ({ ...prev, startDate: e.target.value }))} className="w-full sm:w-auto min-w-[90px] px-2 py-1 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                                <span className="text-slate-400">-</span>
                                <input type="date" value={woFilters.endDate} onChange={(e) => setWoFilters(prev => ({ ...prev, endDate: e.target.value }))} className="w-full sm:w-auto min-w-[90px] px-2 py-1 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>

                            <div className="hidden sm:flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 border border-slate-200 dark:border-slate-600 shrink-0">
                                <button onClick={() => setWoTab('active')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'active' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                                    Pendientes
                                </button>
                                <button onClick={() => setWoTab('history')} className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${woTab === 'history' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
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
                            <div key={wo.id} onClick={() => onSelectWorkOrder(wo.id)} className="p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-3 active:scale-[0.98] transition-transform">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${typeBadge(wo.type)}`}>
                                            {wo.type}
                                        </span>
                                        <h4 className="font-bold text-slate-900 dark:text-white line-clamp-2">{wo.title}</h4>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">#{wo.id}</div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(wo.status)}`}>
                                        {wo.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <span>{new Date(wo.createdAt).toLocaleDateString()}</span>
                                    <ChevronRight size={16} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hidden md:block bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50">
                                        <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Título</th>
                                        <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tipo</th>
                                        <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Estado</th>
                                        <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {relatedWOs.map(wo => (
                                        <tr key={wo.id} onClick={() => onSelectWorkOrder(wo.id)} className="group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="p-3">
                                                <div className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    {wo.title}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">#{wo.id}</div>
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
                                                <span className="text-sm text-slate-600 dark:text-slate-400">
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
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No hay órdenes con estos filtros</p>
                </div>
            )}
        </div>
    );
};
