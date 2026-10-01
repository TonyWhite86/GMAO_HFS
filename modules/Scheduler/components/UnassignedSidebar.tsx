import React from 'react';
import { Calendar as CalendarIcon, Search } from 'lucide-react';
import { WorkOrder, User, WOStatus } from '../../../types';
import { WO_STATUS_CONFIG } from '../../../constants';

interface UnassignedSidebarProps {
    unassignedWOs: WorkOrder[];
    technicians: User[];
    searchTerm: string;
    onSearchChange: (value: string) => void;
    onDragStart: (e: React.DragEvent, wo: WorkOrder) => void;
    onSelectWO: (wo: WorkOrder) => void;
    onAssign: (wo: WorkOrder, userId: string, date: Date) => void;
}

export const UnassignedSidebar: React.FC<UnassignedSidebarProps> = ({
    unassignedWOs,
    technicians,
    searchTerm,
    onSearchChange,
    onDragStart,
    onSelectWO,
    onAssign
}) => {
    return (
        <div className="w-full md:w-64 flex-shrink-0 bg-white dark:bg-slate-700 border-r-0 md:border-r border-b md:border-b-0 border-slate-200 dark:border-slate-700 flex flex-col h-1/3 md:h-full rounded-lg shadow-sm transition-colors">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <CalendarIcon size={18} />
                    Sin asignar
                </h2>
                <p className="text-xs text-slate-400 mt-1 mb-3">Arrastra para agendar</p>

                <div className="relative">
                    <input
                        type="text"
                        id="scheduler-sidebar-search"
                        name="sidebarSearch"
                        placeholder="Buscar por título..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2 bg-slate-100 dark:bg-slate-800/50">
                {unassignedWOs.map(wo => {
                    const statusCfg = WO_STATUS_CONFIG[wo.status as WOStatus];
                    return (
                        <div
                            key={wo.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, wo)}
                            onClick={() => onSelectWO(wo)}
                            className="bg-white dark:bg-slate-700 p-3 rounded shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 group transition-colors active:cursor-grabbing border-l-4"
                            style={{ borderLeftColor: statusCfg?.bgClass?.includes('yellow') ? '#eab308' : statusCfg?.bgClass?.includes('blue') ? '#3b82f6' : statusCfg?.bgClass?.includes('purple') ? '#a855f7' : statusCfg?.bgClass?.includes('green') ? '#22c55e' : undefined }}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${statusCfg?.bgClass || ''}`}>
                                    {wo.status}
                                </span>
                            </div>
                            <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{wo.title}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{wo.priority} | {wo.section}</div>

                            {/* Quick Assign Dropdown */}
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                <select
                                    id={`assign-${wo.id}`}
                                    name={`assign-${wo.id}`}
                                    aria-label={`Asignar tarea ${wo.title}`}
                                    className="w-full text-xs p-1 border rounded bg-white dark:bg-slate-700 dark:text-white border-slate-200 dark:border-slate-600"
                                    onChange={(e) => {
                                        if (e.target.value) onAssign(wo, e.target.value, new Date());
                                    }}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Asignar rápido...</option>
                                    {technicians
                                        .filter(t => {
                                            const allowedSections = [wo.section, ...(wo.collaboratingSections || [])];
                                            return t.sections.some(s => allowedSections.includes(s));
                                        })
                                        .map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    );
                })}
                {unassignedWOs.length === 0 && (
                    <div className="text-center p-4 text-slate-400 text-sm">No hay órdenes pendientes de asignar.</div>
                )}
            </div>
        </div>
    );
};
