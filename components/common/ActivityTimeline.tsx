import React from 'react';
import {
    PlayCircle, PauseCircle, CheckCircle2, Package, UserPlus, UserMinus,
    Star, Wrench, Link2, MessageSquare, FileText, AlertTriangle
} from 'lucide-react';
import { Attachment, Comment, WorkOrder, WorkOrderEvent, WorkOrderEventKind } from '../../types';
import { formatDuration } from '../../utils/timeTracking';

interface ActivityItem {
    key: string;
    timestamp: string;
    kind: 'event' | 'comment';
    icon: React.ReactNode;
    iconClass: string;
    title: string;
    detail?: string;
    actorName?: string | null;
    isSystem?: boolean;
    attachments?: Attachment[];
}

const fmtDateTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }) : '';

/** Icono + texto de cada tipo de evento del histórico. */
const eventPresentation = (e: WorkOrderEvent, wo: WorkOrder): { icon: React.ReactNode; iconClass: string; title: string; detail?: string } => {
    switch (e.kind) {
        case WorkOrderEventKind.CREATE:
            return {
                icon: <Package size={14} />,
                iconClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                title: 'Orden creada'
            };
        case WorkOrderEventKind.STATUS:
            return {
                icon: <PlayCircle size={14} />,
                iconClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
                title: e.status === 'En Progreso' ? 'Inicio del trabajo' : `Estado: ${e.status}`,
                detail: e.note || undefined
            };
        case WorkOrderEventKind.PAUSE:
            return {
                icon: <PauseCircle size={14} />,
                iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
                title: 'Trabajo pausado',
                detail: e.note ? `Motivo: ${e.note}` : 'Motivo: no indicado'
            };
        case WorkOrderEventKind.RESUME:
            return {
                icon: <PlayCircle size={14} />,
                iconClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
                title: 'Trabajo reanudado',
                detail: e.note || undefined
            };
        case WorkOrderEventKind.COMPLETE: {
            const mins = wo.timeSpentMinutes ?? 0;
            return {
                icon: <CheckCircle2 size={14} />,
                iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
                title: 'Orden completada',
                detail: `Fin: ${fmtDateTime(wo.closedAt)} · Tiempo: ${formatDuration(mins)}` +
                    (wo.timeSource === 'manual' ? ' · registrado a mano' : '')
            };
        }
        case WorkOrderEventKind.ASSIGN:
            return {
                icon: <UserPlus size={14} />,
                iconClass: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300',
                title: e.note || 'Asignación'
            };
        case WorkOrderEventKind.UNASSIGN:
            return {
                icon: <UserMinus size={14} />,
                iconClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                title: e.note || 'Desasignación'
            };
        case WorkOrderEventKind.PRIORITY:
            return {
                icon: <Star size={14} />,
                iconClass: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300',
                title: e.note ? `Prioridad cambiada: ${e.note}` : 'Prioridad cambiada'
            };
        case WorkOrderEventKind.PARTS:
            return {
                icon: <Wrench size={14} />,
                iconClass: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300',
                title: e.note || 'Repuestos actualizados'
            };
        case WorkOrderEventKind.CONVERT:
            return {
                icon: <Link2 size={14} />,
                iconClass: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
                title: e.note || 'Creada desde una incidencia'
            };
        default:
            return {
                icon: <MessageSquare size={14} />,
                iconClass: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                title: e.note || e.kind
            };
    }
};

interface ActivityTimelineProps {
    workOrder: WorkOrder;
    comments?: Comment[];
    currentUserId?: string;
    setViewMedia: (media: { type: 'image' | 'video' | 'pdf' | 'file'; url: string; name: string } | null) => void;
    title?: string;
    emptyMessage?: string;
    maxHeight?: string;
}

/**
 * Unifica el log de eventos (`work_order_events`) y los comentarios en una sola
 * línea de tiempo, ordenados por fecha y con la hora dentro del mensaje.
 */
export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
    workOrder, comments = [], currentUserId, setViewMedia,
    title = 'Actividad',
    emptyMessage = 'Todavía no hay actividad registrada.',
    maxHeight = '520px'
}) => {
    const items: ActivityItem[] = React.useMemo(() => {
        const out: ActivityItem[] = [];

        (workOrder.events || []).forEach(e => {
            const p = eventPresentation(e, workOrder);
            out.push({
                key: `e-${e.id}`,
                timestamp: e.createdAt,
                kind: 'event',
                icon: p.icon,
                iconClass: p.iconClass,
                title: p.title,
                detail: p.detail,
                actorName: e.actorName,
                isSystem: true
            });
        });

        (comments || []).forEach(c => {
            out.push({
                key: `c-${c.id}`,
                timestamp: c.createdAt,
                kind: 'comment',
                icon: <MessageSquare size={14} />,
                iconClass: c.isSystem
                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
                title: c.text,
                actorName: c.isSystem ? (c.userName || 'Sistema') : c.userName,
                isSystem: !!c.isSystem,
                attachments: c.attachments
            });
        });

        return out.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [workOrder, comments]);

    return (
        <div className="space-y-4">
            {title && (
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={16} /> {title}
                </h3>
            )}

            <div className="space-y-0 overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight }}>
                {items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">{emptyMessage}</div>
                ) : (
                    <ol className="relative border-l border-slate-200 dark:border-slate-600 ml-2">
                        {items.map(item => (
                            <li key={item.key} className="relative pb-4 pl-6">
                                <span className={`absolute -left-[11px] top-0 w-[22px] h-[22px] rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-700 ${item.iconClass}`}>
                                    {item.icon}
                                </span>

                                <div className={`rounded-xl border px-3 py-2 ${item.kind === 'event'
                                    ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700'
                                    : (item.isSystem
                                        ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700 italic'
                                        : (item.actorName && currentUserId && workOrder.createdBy === currentUserId
                                            ? 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50'
                                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'))}
                                    `}>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                                        {item.kind === 'comment' && !item.isSystem ? `“${item.title}”` : item.title}
                                    </p>

                                    {item.detail && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.detail}</p>
                                    )}

                                    {item.attachments && item.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {item.attachments.map((att, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setViewMedia({ type: att.type as any, url: att.url, name: att.name })}
                                                    className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                                                >
                                                    {att.type === 'image'
                                                        ? <img src={att.url} alt="" className="w-full h-full object-cover" />
                                                        : <FileText size={20} className="m-auto text-slate-400" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
                                        {item.actorName && <span className="font-semibold">{item.actorName}</span>}
                                        <span>{fmtDateTime(item.timestamp)}</span>
                                        {item.kind === 'event' && (item.detail || '').includes('registrado a mano') && (
                                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                                                <AlertTriangle size={11} /> Manual
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
};
