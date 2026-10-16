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
                iconClass: 'bg-surface-3 text-txt-2',
                title: 'Orden creada'
            };
        case WorkOrderEventKind.STATUS:
            return {
                icon: <PlayCircle size={14} />,
                iconClass: 'bg-accent-dim text-accent',
                title: e.status === 'En Progreso' ? 'Inicio del trabajo' : `Estado: ${e.status}`,
                detail: e.note || undefined
            };
        case WorkOrderEventKind.PAUSE:
            return {
                icon: <PauseCircle size={14} />,
                iconClass: 'bg-warn-dim text-warn',
                title: 'Trabajo pausado',
                detail: e.note ? `Motivo: ${e.note}` : 'Motivo: no indicado'
            };
        case WorkOrderEventKind.RESUME:
            return {
                icon: <PlayCircle size={14} />,
                iconClass: 'bg-accent-dim text-accent',
                title: 'Trabajo reanudado',
                detail: e.note || undefined
            };
        case WorkOrderEventKind.COMPLETE: {
            const mins = wo.timeSpentMinutes ?? 0;
            return {
                icon: <CheckCircle2 size={14} />,
                iconClass: 'bg-ok-dim text-ok',
                title: 'Orden completada',
                detail: `Fin: ${fmtDateTime(wo.closedAt)} · Tiempo: ${formatDuration(mins)}` +
                    (wo.timeSource === 'manual' ? ' · registrado a mano' : '')
            };
        }
        case WorkOrderEventKind.ASSIGN:
            return {
                icon: <UserPlus size={14} />,
                iconClass: 'bg-spec-dim text-spec',
                title: e.note || 'Asignación'
            };
        case WorkOrderEventKind.UNASSIGN:
            return {
                icon: <UserMinus size={14} />,
                iconClass: 'bg-surface-3 text-txt-2',
                title: e.note || 'Desasignación'
            };
        case WorkOrderEventKind.PRIORITY:
            return {
                icon: <Star size={14} />,
                iconClass: 'bg-warn-dim text-warn',
                title: e.note ? `Prioridad cambiada: ${e.note}` : 'Prioridad cambiada'
            };
        case WorkOrderEventKind.PARTS:
            return {
                icon: <Wrench size={14} />,
                iconClass: 'bg-accent-dim text-accent',
                title: e.note || 'Repuestos actualizados'
            };
        case WorkOrderEventKind.CONVERT:
            return {
                icon: <Link2 size={14} />,
                iconClass: 'bg-accent-dim text-accent',
                title: e.note || 'Creada desde una incidencia'
            };
        default:
            return {
                icon: <MessageSquare size={14} />,
                iconClass: 'bg-surface-3 text-txt-2',
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
                    ? 'bg-surface-3 text-txt-3'
                    : 'bg-accent-dim text-accent',
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
                <h3 className="text-xs font-bold text-txt-3 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={16} /> {title}
                </h3>
            )}

            <div className="space-y-0 overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight }}>
                {items.length === 0 ? (
                    <div className="text-center py-8 text-txt-3 text-sm">{emptyMessage}</div>
                ) : (
                    <ol className="relative border-l border-line ml-2">
                        {items.map(item => (
                            <li key={item.key} className="relative pb-4 pl-6">
                                <span className={`absolute -left-[11px] top-0 w-[22px] h-[22px] rounded-full flex items-center justify-center ring-4 ring-[color:var(--surface)] ${item.iconClass}`}>
                                    {item.icon}
                                </span>

                                <div className={`rounded-xl border px-3 py-2 ${item.kind === 'event'
                                    ? 'bg-surface-2 border-line'
                                    : (item.isSystem
                                        ? 'bg-surface-2 border-line italic'
                                        : (item.actorName && currentUserId && workOrder.createdBy === currentUserId
                                            ? 'bg-accent-dim border-accent-border'
                                            : 'bg-surface border-line'))}
                                    `}>
                                    <p className="text-sm font-semibold text-txt whitespace-pre-wrap break-words">
                                        {item.kind === 'comment' && !item.isSystem ? `“${item.title}”` : item.title}
                                    </p>

                                    {item.detail && (
                                        <p className="text-xs text-txt-2 mt-1">{item.detail}</p>
                                    )}

                                    {item.attachments && item.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {item.attachments.map((att, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setViewMedia({ type: att.type as any, url: att.url, name: att.name })}
                                                    className="w-14 h-14 rounded-lg overflow-hidden border border-line bg-surface-2"
                                                >
                                                    {att.type === 'image'
                                                        ? <img src={att.url} alt="" className="w-full h-full object-cover" />
                                                        : <FileText size={20} className="m-auto text-txt-3" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <p className="text-[11px] text-txt-3 mt-1.5 flex items-center gap-1.5 flex-wrap">
                                        {item.actorName && <span className="font-semibold">{item.actorName}</span>}
                                        <span>{fmtDateTime(item.timestamp)}</span>
                                        {item.kind === 'event' && (item.detail || '').includes('registrado a mano') && (
                                            <span className="inline-flex items-center gap-1 text-warn font-bold">
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
