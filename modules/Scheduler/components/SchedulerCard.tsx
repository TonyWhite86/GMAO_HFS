import React from 'react';
import { Clock, Undo2 } from 'lucide-react';
import { WorkOrder, WOStatus, WOPriority, WOType } from '../../../types';
import { PRIORITY_CONFIG, WO_TYPE_CONFIG, WO_STATUS_CONFIG } from '../../../constants';
import { formatDuration } from '../../../utils/timeTracking';

interface SchedulerCardProps {
    wo: WorkOrder;
    techId: string;
    viewMode: 'day' | 'week';
    onDragStart: (e: React.DragEvent, wo: WorkOrder) => void;
    onSelect: (wo: WorkOrder) => void;
    onUnassign: (wo: WorkOrder, userId?: string) => void;
}

export const SchedulerCard: React.FC<SchedulerCardProps> = ({ wo, techId, viewMode, onDragStart, onSelect, onUnassign }) => {
    const isCompleted = wo.status === WOStatus.COMPLETED;
    const priorityCfg = PRIORITY_CONFIG[wo.priority as WOPriority] || PRIORITY_CONFIG[WOPriority.MEDIUM];
    const typeCfg = WO_TYPE_CONFIG[wo.type as WOType] || WO_TYPE_CONFIG[WOType.CORRECTIVE];
    const PriorityIcon = priorityCfg.icon;
    const statusCfg = WO_STATUS_CONFIG[wo.status as WOStatus];
    const borderLeftColor = statusCfg?.bgClass?.includes('yellow') ? '#eab308' : statusCfg?.bgClass?.includes('blue') ? '#3b82f6' : statusCfg?.bgClass?.includes('purple') ? '#a855f7' : statusCfg?.bgClass?.includes('green') ? '#22c55e' : undefined;

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, wo)}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(wo);
            }}
            className={`
                p-2 rounded text-xs border shadow-sm cursor-pointer pointer-events-auto hover:shadow-md transition-shadow relative group border-l-4
                ${viewMode === 'day' ? 'w-56 flex-shrink-0' : 'w-full'}
                bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-700
                text-slate-800 dark:text-slate-200
            `}
            style={{ borderLeftColor }}
        >
            {!isCompleted && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onUnassign(wo, techId);
                    }}
                    title="Desasignar"
                    className="absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 p-1 bg-white dark:bg-slate-700 rounded-full text-slate-400 hover:text-red-500 border border-slate-200 dark:border-slate-600 shadow-sm z-50 transition-all scale-75 hover:scale-100"
                >
                    <Undo2 size={12} strokeWidth={3} />
                </button>
            )}
            <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${statusCfg?.bgClass || ''}`}>
                    {wo.status}
                </span>
            </div>
            <div className="font-semibold break-words whitespace-normal leading-tight mb-1">
                {wo.title}
            </div>
            {/* Show assigned subtasks */}
            {wo.subtasks?.filter(st => st.assignedUserIds?.includes(techId)).map(st => (
                <div key={st.id} className="text-[10px] bg-slate-100 dark:bg-slate-600/50 rounded px-1 py-0.5 mt-0.5 border border-slate-200 dark:border-slate-600 truncate flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${st.completed ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    {st.description}
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-1 text-[10px] mt-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${typeCfg.bgClass}`}>
                    {typeCfg.label}
                </span>
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border ${priorityCfg.bgClass}`}>
                    <PriorityIcon size={10} />
                    {wo.priority}
                </span>
                {wo.timeSpentMinutes !== undefined && wo.timeSpentMinutes > 0 && (
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-bold ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                        <Clock size={10} />
                        {formatDuration(wo.timeSpentMinutes)}
                    </span>
                )}
            </div>
            <div className="text-[9px] text-slate-400 mt-1">{wo.id}</div>
        </div>
    );
};
