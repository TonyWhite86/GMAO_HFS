import React from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle, Wrench, ArrowRight, CheckCircle, PlayCircle, PauseCircle } from 'lucide-react';
import { WorkOrder, WOStatus, WOPriority, Equipment, User } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { PRIORITY_CONFIG } from '../../constants';
import { hasActiveSession } from '../../utils/timeTracking';

interface WorkOrderCardProps {
    wo: WorkOrder;
    equipment: Equipment[];
    users: User[];
    onClick: () => void;
    onStatusAction?: (wo: WorkOrder, nextStatus: WOStatus) => void;
    onComplete?: (wo: WorkOrder) => void;
}

export const WorkOrderCard: React.FC<WorkOrderCardProps> = ({
    wo,
    equipment,
    users,
    onClick,
    onStatusAction,
    onComplete,
}) => {
    const assignedUser = users.find(u => u.id === wo.assignedUserId);
    const eq = equipment.find(e => e.id === wo.equipmentId);

    // True when actively working (IN_PROGRESS with an open session). A paused WO
    // is IN_PROGRESS but with a closed session, so it offers "Reanudar".
    const isRunning = wo.status === WOStatus.IN_PROGRESS && hasActiveSession(wo.statusHistory);

    // Logic for overdue tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDate = wo.scheduledDate ? new Date(wo.scheduledDate) : new Date(wo.createdAt);
    scheduledDate.setHours(0, 0, 0, 0);
    const isOverdue = wo.status !== WOStatus.COMPLETED && scheduledDate < today;

    const [showCollaborators, setShowCollaborators] = React.useState(false);

    // Resolve collaborators
    const collaborators = wo.collaborators
        ?.map(id => users.find(u => u.id === id))
        .filter((u): u is User => !!u) || [];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="relative mb-4"
        >
            <div
                className="relative bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 active:scale-[0.99] transition-all cursor-pointer z-10"
                onClick={onClick}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2">
                        <StatusBadge status={wo.status} type="workOrder" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded">
                            {wo.id}
                        </span>
                        {isOverdue && (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-tight flex items-center gap-1">
                                <AlertTriangle size={10} className="fill-red-600/10" />
                                Retrasado
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className={`w-1 rounded-full self-stretch flex-shrink-0 ${PRIORITY_CONFIG[wo.priority]?.color === 'red' ? 'bg-red-500' :
                        PRIORITY_CONFIG[wo.priority]?.color === 'orange' ? 'bg-orange-500' :
                            PRIORITY_CONFIG[wo.priority]?.color === 'blue' ? 'bg-blue-500' : 'bg-slate-300'
                        }`}></div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate">{wo.title}</h3>

                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {eq && (
                                <div className="flex items-center gap-1 truncate pr-2">
                                    <Wrench size={12} className="flex-shrink-0" />
                                    <span className="truncate">{eq.name}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                                <Clock size={12} className="flex-shrink-0" />
                                <span className={isOverdue ? "text-red-500 font-medium whitespace-nowrap" : "whitespace-nowrap"}>
                                    {new Date(wo.scheduledDate || wo.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3 mt-3">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        {assignedUser ? (
                            <>
                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-[10px] text-slate-700 dark:text-slate-200">
                                    {assignedUser.name.charAt(0)}
                                </div>
                                <span className="truncate max-w-[80px]">{assignedUser.name.split(' ')[0]}</span>
                            </>
                        ) : (
                            <span className="text-slate-400 italic">Sin asignar</span>
                        )}

                        {/* Collaborators Badge */}
                        {collaborators.length > 0 && (
                            <div className="relative ml-1">
                                <div
                                    className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700 flex items-center justify-center text-[10px] text-purple-700 dark:text-purple-300 font-bold cursor-pointer hover:scale-110 transition-transform"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowCollaborators(!showCollaborators);
                                    }}
                                >
                                    +{collaborators.length}
                                </div>
                                {showCollaborators && (
                                    <div
                                        className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-50 animate-in fade-in zoom-in-95 duration-200"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Colaboradores</div>
                                        <div className="space-y-1">
                                            {collaborators.map(c => (
                                                <div key={c.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50">
                                                    <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[8px]">
                                                        {c.name.charAt(0)}
                                                    </div>
                                                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{c.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {wo.status !== WOStatus.COMPLETED && (onStatusAction || onComplete) && (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {onStatusAction && (
                                <button
                                    onClick={() => {
                                        const nextStatus = isRunning ? WOStatus.PENDING : WOStatus.IN_PROGRESS;
                                        onStatusAction(wo, nextStatus);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isRunning
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200'
                                        }`}
                                >
                                    {isRunning ? (
                                        <><PauseCircle size={14} /> Pausar</>
                                    ) : wo.status === WOStatus.IN_PROGRESS ? (
                                        <><PlayCircle size={14} /> Reanudar</>
                                    ) : (
                                        <><PlayCircle size={14} /> Empezar</>
                                    )}
                                </button>
                            )}
                            {onComplete && (
                                <button
                                    onClick={() => onComplete(wo)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 transition-colors"
                                >
                                    <CheckCircle size={14} /> Finalizar
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
