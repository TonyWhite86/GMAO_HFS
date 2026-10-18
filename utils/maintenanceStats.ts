import { WorkOrder, WOStatus } from '../types';

export type DueTone = 'ko' | 'warn' | 'accent' | null;

const startOfDay = (d: Date): Date => {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
};

/** Fecha efectiva de la OT: la programada o, en su defecto, la de creación. */
export const getEffectiveDate = (wo: Pick<WorkOrder, 'scheduledDate' | 'createdAt'>): Date =>
    new Date(wo.scheduledDate || wo.createdAt);

/**
 * Etiqueta de urgencia: 'Vencida' (pasada y no completada), 'Hoy', 'Mañana'
 * o null (sin urgencia). Las OTs completadas nunca se marcan como vencidas.
 */
export const getDueLabel = (
    wo: Pick<WorkOrder, 'scheduledDate' | 'createdAt' | 'status'>,
    now: Date = new Date()
): string | null => {
    const day = startOfDay(getEffectiveDate(wo)).getTime();
    const today = startOfDay(now).getTime();
    if (day < today) return wo.status === WOStatus.COMPLETED ? null : 'Vencida';
    if (day === today) return 'Hoy';
    if (day === today + 86400000) return 'Mañana';
    return null;
};

/** Tono para colorear la fecha según su urgencia. */
export const getDueTone = (
    wo: Pick<WorkOrder, 'scheduledDate' | 'createdAt' | 'status'>,
    now: Date = new Date()
): DueTone => {
    const label = getDueLabel(wo, now);
    if (label === 'Vencida') return 'ko';
    if (label === 'Hoy') return 'warn';
    if (label === 'Mañana') return 'accent';
    return null;
};

/** ¿La OT es urgente (vencida, hoy o mañana)? Atajo "≤ Mañana". */
export const isDueByTomorrow = (
    wo: Pick<WorkOrder, 'scheduledDate' | 'createdAt' | 'status'>,
    now: Date = new Date()
): boolean => getDueLabel(wo, now) !== null || startOfDay(getEffectiveDate(wo)).getTime() < startOfDay(now).getTime();

/** ISO de hoy + n días, a las 08:00 (ajuste rápido +7d/+15d/+30d desde hoy). */
export const quickDate = (days: number, now: Date = new Date()): string => {
    const d = startOfDay(now);
    d.setDate(d.getDate() + days);
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
};

export interface TimeframeGroups<T> {
    hoy: T[];
    manana: T[];
    estaSemana: T[];
    proximas: T[];
}

/**
 * Agrupación temporal de actuaciones: Hoy / Mañana / Esta semana (hasta el
 * domingo en curso) / Próximas. Sin fecha → "Próximas".
 */
export const groupByTimeframe = <T extends { scheduledDate?: string; createdAt: string }>(
    items: T[],
    now: Date = new Date()
): TimeframeGroups<T> => {
    const today = startOfDay(now).getTime();
    const tomorrow = today + 86400000;
    // fin de la semana en curso (domingo 23:59)
    const weekEnd = new Date(today);
    const dow = weekEnd.getDay(); // 0=domingo
    weekEnd.setDate(weekEnd.getDate() + (dow === 0 ? 0 : 7 - dow));
    weekEnd.setHours(23, 59, 59, 999);
    const weekEndTime = weekEnd.getTime();

    const out: TimeframeGroups<T> = { hoy: [], manana: [], estaSemana: [], proximas: [] };
    for (const item of items) {
        const t = startOfDay(new Date(item.scheduledDate || item.createdAt)).getTime();
        if (t < today || t === today) out.hoy.push(item);
        else if (t === tomorrow) out.manana.push(item);
        else if (t <= weekEndTime) out.estaSemana.push(item);
        else out.proximas.push(item);
    }
    return out;
};

/** ¿La OT tiene checklist con puntos sin responder? */
export const hasPendingChecklist = (wo: WorkOrder): boolean => {
    const items = wo.closureChecklist || [];
    if (items.length === 0 || wo.status === WOStatus.COMPLETED) return false;
    const answers = wo.checklistAnswers || {};
    return items.some(it => {
        const a = answers[it.id];
        return !a || ((a.sel !== 'si' && a.sel !== 'no') && !(a.val && a.val.trim()));
    });
};
