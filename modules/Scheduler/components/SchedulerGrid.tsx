import React from 'react';
import { Plus, User as UserIcon } from 'lucide-react';
import { WorkOrder, User, WOStatus } from '../../../types';
import { toLocalDateStr } from '../../../utils/dateUtils';
import { formatDuration } from '../../../utils/timeTracking';
import { SchedulerCard } from './SchedulerCard';

interface SchedulerGridProps {
    viewMode: 'day' | 'week';
    daysToShow: Date[];
    technicians: User[];
    workOrders: WorkOrder[];
    selectedSection: string;
    onClearSection: () => void;
    onDragStart: (e: React.DragEvent, wo: WorkOrder) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, userId: string, date: Date) => void;
    onUnassign: (wo: WorkOrder, userId?: string) => void;
    onSelectWO: (wo: WorkOrder) => void;
    onCreateAtSlot: (userId: string, date: Date) => void;
}

export const SchedulerGrid: React.FC<SchedulerGridProps> = ({
    viewMode,
    daysToShow,
    technicians,
    workOrders,
    selectedSection,
    onClearSection,
    onDragStart,
    onDragOver,
    onDrop,
    onUnassign,
    onSelectWO,
    onCreateAtSlot
}) => {
    return (
        <div className="flex-1 overflow-auto bg-surface rounded-lg shadow-sm border border-line transition-colors">
            <div className="grid h-auto min-h-full content-start min-w-[800px]" style={{ gridTemplateColumns: `100px repeat(${daysToShow.length}, minmax(0, 1fr))` }}>
                {/* Header Row */}
                <div className="p-3 bg-surface-2 border-b border-r border-line font-semibold text-txt-2 flex items-center justify-center sticky top-0 z-20 shadow-sm">
                    Técnico
                </div>
                {daysToShow.map(day => {
                    const dayDateStr = toLocalDateStr(day);
                    const isToday = toLocalDateStr(new Date()) === dayDateStr;
                    return (
                        <div key={day.toISOString()} className={`flex flex-col items-center justify-center p-2 border-b border-line font-semibold text-center sticky top-0 z-20 shadow-sm transition-colors ${day.getDay() === 0 ? 'text-ko' : ''} ${isToday ? 'bg-accent text-white  text-txt ring-1 ring-accent' : 'bg-surface-2 text-txt-2'}`}>
                            <span className="text-lg leading-none">{day.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}</span>
                            <span className={`text-[10px] uppercase tracking-wider mt-0.5 ${isToday ? 'text-white/90' : 'opacity-70'}`}>{day.toLocaleDateString('es-ES', { weekday: 'long' })}</span>
                        </div>
                    );
                })}

                {/* User Rows */}
                {technicians.map((tech) => {
                    // Filter user's WOs (Scheduled OR Completed OR assigned via Subtasks OR Collaborators)
                    const techAllWOs = workOrders.filter(wo => {
                        const isDirectlyAssigned = wo.assignedUserId === tech.id;
                        const isSubtaskAssigned = wo.subtasks?.some(st => st.assignedUserIds?.includes(tech.id));
                        const isCollaborator = wo.collaborators?.includes(tech.id);
                        return isDirectlyAssigned || isSubtaskAssigned || isCollaborator;
                    });

                    return (
                        <React.Fragment key={tech.id}>
                            {/* User Column */}
                            <div className="p-3 border-r border-b border-line flex items-center justify-center bg-surface sticky left-0 z-10">
                                <div className="text-center">
                                    <div className="text-sm font-medium text-txt-2">{tech.name.split(' ')[0]}</div>
                                    <div className="text-xs text-txt-3">{techAllWOs.length} tareas</div>
                                </div>
                            </div>

                            {/* Days Columns */}
                            {daysToShow.map((day) => {
                                const dayDateStr = toLocalDateStr(day);
                                const tasksForDay = techAllWOs.filter(wo => {
                                    if (!wo.scheduledDate && !wo.createdAt) return false;
                                    const taskDate = wo.scheduledDate ? wo.scheduledDate : wo.createdAt;
                                    return toLocalDateStr(new Date(taskDate)) === dayDateStr;
                                });

                                // Highlight for Today
                                const isToday = toLocalDateStr(new Date()) === dayDateStr;

                                return (
                                    <div
                                        key={day.toISOString()}
                                        onDragOver={onDragOver}
                                        onDrop={(e) => onDrop(e, tech.id, day)}
                                        className={`
                                            p-2 border-b border-line min-h-[85px] transition-colors relative group
                                            ${isToday ? 'bg-accent-dim  ring-1 ring-inset ring-accent/40' : 'bg-surface-2/50 bg-surface/30'}
                                            hover:bg-accent-dim 
                                        `}
                                    >
                                        {/* Summary for Day View */}
                                        {viewMode === 'day' && tasksForDay.length > 0 && (
                                            <div className="mb-3 flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-surface rounded-md border border-line shadow-sm shadow-accent/10">
                                                    <span className="text-[10px] font-bold text-txt-3 uppercase tracking-tight">Total:</span>
                                                    <span className="text-xs font-black text-accent">
                                                        {formatDuration(tasksForDay.reduce((acc, curr) => acc + (curr.timeSpentMinutes || 0), 0))}
                                                    </span>
                                                </div>
                                                {tasksForDay.filter(t => t.status === WOStatus.COMPLETED).length > 0 && (
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface rounded-md border border-line shadow-sm shadow-ok/10">
                                                        <span className="text-[10px] font-bold text-txt-3 uppercase tracking-tight">Cerrado:</span>
                                                        <span className="text-xs font-black text-ok">
                                                            {formatDuration(tasksForDay.filter(t => t.status === WOStatus.COMPLETED).reduce((acc, curr) => acc + (curr.timeSpentMinutes || 0), 0))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Render Tasks */}
                                        <div className={`pointer-events-none ${viewMode === 'day' ? 'flex flex-row flex-wrap gap-2 content-start' : 'space-y-2'}`}>
                                            {tasksForDay.map(wo => (
                                                <SchedulerCard
                                                    key={wo.id}
                                                    wo={wo}
                                                    techId={tech.id}
                                                    viewMode={viewMode}
                                                    onDragStart={onDragStart}
                                                    onSelect={onSelectWO}
                                                    onUnassign={onUnassign}
                                                />
                                            ))}
                                        </div>

                                        {/* Add button */}
                                        <button
                                            onClick={() => onCreateAtSlot(tech.id, day)}
                                            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-accent-dim hover:bg-blue-200 text-accent rounded-full p-1 transition-all shadow-sm"
                                            title="Crear tarea aquí"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    );
                })}

                {technicians.length === 0 && (
                    <div
                        className="col-span-full py-12 flex flex-col items-center justify-center bg-surface-2/50 bg-surface/20 text-txt-3"
                        style={{ gridColumn: `1 / span ${daysToShow.length + 1}` }}
                    >
                        <div className="bg-surface p-6 rounded-xl border border-dashed border-line shadow-sm flex flex-col items-center gap-3">
                            <UserIcon size={32} className="text-txt-3" />
                            <p className="text-sm font-medium">No hay técnicos asignados a la sección: <span className="font-bold text-txt-2">"{selectedSection}"</span></p>
                            <button
                                onClick={onClearSection}
                                className="text-xs text-accent hover:text-accent font-bold underline underline-offset-4"
                            >
                                Ver todas las secciones
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
