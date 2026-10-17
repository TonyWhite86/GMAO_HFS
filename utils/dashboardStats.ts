import { Incident, PreventivePlan, WorkOrder, WOStatus } from '../types';

/* ── Utilidades de fecha ── */

const dayKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfDay = (d: Date): Date => {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
};

/* ── OTs del usuario (vista Técnico) ── */

const scheduledDay = (wo: WorkOrder): string => (wo.scheduledDate || wo.createdAt).split('T')[0];

export const getMyTodayWOs = (workOrders: WorkOrder[], userId: string, now: Date = new Date()): WorkOrder[] => {
    const today = dayKey(now);
    return workOrders.filter(wo => {
        if (wo.assignedUserId !== userId || wo.status === WOStatus.COMPLETED) return false;
        return scheduledDay(wo) <= today;
    });
};

export const getMyTomorrowWOs = (workOrders: WorkOrder[], userId: string, now: Date = new Date()): WorkOrder[] => {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = dayKey(tomorrow);
    return workOrders.filter(wo => {
        if (wo.assignedUserId !== userId || wo.status === WOStatus.COMPLETED) return false;
        return scheduledDay(wo) === tomorrowStr;
    });
};

/* ── Tendencias (sparklines) ── */

export interface WeekTrend {
    label: string;
    created: number;
    completed: number;
}

/** OTs creadas y completadas por semana (últimas `weeks` semanas, lunes como inicio). */
export const computeWoWeeklyTrend = (workOrders: WorkOrder[], weeks = 8, now: Date = new Date()): WeekTrend[] => {
    const out: WeekTrend[] = [];
    const buckets = new Map<string, { label: string; created: number; completed: number }>();

    for (let i = weeks - 1; i >= 0; i--) {
        const d = startOfDay(now);
        d.setDate(d.getDate() - i * 7);
        const key = dayKey(d);
        const bucket = { label: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }), created: 0, completed: 0 };
        buckets.set(key, bucket);
        out.push(bucket);
    }

    const weekStarts = [...buckets.keys()];
    // Comparación por clave YYYY-MM-DD: evita desfases de zona horaria al
    // mezclar fechas ISO (UTC) con medianoches locales.
    const bucketFor = (iso: string): { created: number; completed: number } | null => {
        const key = dayKey(startOfDay(new Date(iso)));
        for (let i = weekStarts.length - 1; i >= 0; i--) {
            if (key >= weekStarts[i]) return buckets.get(weekStarts[i]) || null;
        }
        return null;
    };

    for (const wo of workOrders) {
        const created = bucketFor(wo.createdAt);
        if (created) created.created++;
        if (wo.closedAt) {
            const completed = bucketFor(wo.closedAt);
            if (completed) completed.completed++;
        }
    }
    return out;
};

/** Horas trabajadas por día (últimos `days` días) según el tiempo registrado al cerrar. */
export const computeHoursDailyTrend = (workOrders: WorkOrder[], days = 7, now: Date = new Date()): number[] => {
    const out = new Array(days).fill(0);
    const start = startOfDay(now);
    start.setDate(start.getDate() - (days - 1));
    for (const wo of workOrders) {
        if (!wo.closedAt || !wo.timeSpentMinutes) continue;
        const idx = Math.floor((startOfDay(new Date(wo.closedAt)).getTime() - start.getTime()) / 86400000);
        if (idx >= 0 && idx < days) out[idx] += wo.timeSpentMinutes / 60;
    }
    return out.map(h => Math.round(h * 10) / 10);
};

/** Incidencias creadas por día (últimos `days` días). */
export const computeIncidentsDailyTrend = (incidents: Incident[], days = 7, now: Date = new Date()): number[] => {
    const out = new Array(days).fill(0);
    const start = startOfDay(now);
    start.setDate(start.getDate() - (days - 1));
    for (const inc of incidents) {
        const idx = Math.floor((startOfDay(new Date(inc.createdAt)).getTime() - start.getTime()) / 86400000);
        if (idx >= 0 && idx < days) out[idx]++;
    }
    return out;
};

/* ── KPIs de calidad ── */

/** % de OTs completadas dentro de plazo (respecto a scheduledDate). */
export const computeOnTimePct = (workOrders: WorkOrder[]): number | null => {
    const closed = workOrders.filter(w => w.closedAt && w.scheduledDate);
    if (closed.length === 0) return null;
    const onTime = closed.filter(w => new Date(w.closedAt!).getTime() <= new Date(w.scheduledDate!).getTime()).length;
    return Math.round((onTime / closed.length) * 100);
};

const itemAnswered = (a?: { sel?: 'si' | 'no' | null; val?: string | null }): boolean =>
    !!a && ((a.sel === 'si' || a.sel === 'no') || !!(a.val && a.val.trim()));

/** % de OTs con checklist cuyos puntos están todos respondidos. */
export const computeChecklistPct = (workOrders: WorkOrder[]): number | null => {
    const withList = workOrders.filter(w => (w.closureChecklist || []).length > 0);
    if (withList.length === 0) return null;
    const ok = withList.filter(w =>
        (w.closureChecklist || []).every(it => itemAnswered((w.checklistAnswers || {})[it.id]))
    ).length;
    return Math.round((ok / withList.length) * 100);
};

export interface PreventiveSummary {
    overdue: number;   // nextRun <= hoy
    thisWeek: number;  // nextRun dentro de 7 días
    next: PreventivePlan | null; // el próximo en lanzarse
}

export const getPreventiveSummary = (plans: PreventivePlan[], now: Date = new Date()): PreventiveSummary => {
    const t = now.getTime();
    const week = t + 7 * 86400000;
    let overdue = 0;
    let thisWeek = 0;
    let next: PreventivePlan | null = null;
    for (const p of plans) {
        const n = new Date(p.nextRun).getTime();
        if (n <= t) overdue++;
        else if (n <= week) thisWeek++;
        if (!next || n < new Date(next.nextRun).getTime()) next = p;
    }
    return { overdue, thisWeek, next };
};

/** % de planes preventivos al día (nextRun futuro). */
export const computePreventivePct = (plans: PreventivePlan[], now: Date = new Date()): number | null => {
    if (plans.length === 0) return null;
    const ok = plans.filter(p => new Date(p.nextRun).getTime() > now.getTime()).length;
    return Math.round((ok / plans.length) * 100);
};

/* ── OTs externas (contratas) ── */

export interface ExternalWoSummary {
    open: WorkOrder[];
    totalPrice: number;
}

export const getExternalWoSummary = (workOrders: WorkOrder[]): ExternalWoSummary => {
    const open = workOrders.filter(w => w.isExternal && w.status !== WOStatus.COMPLETED);
    const totalPrice = open.reduce((acc, w) => acc + (w.externalPrice || 0), 0);
    return { open, totalPrice };
};

/* ── Actividad reciente ── */

export interface ActivityEntry {
    id: string;
    kind: 'wo' | 'incident';
    refId: string;
    title: string;
    text: string;
    actorName: string;
    createdAt: string;
}

const WO_EVENT_TEXT: Record<string, string> = {
    create: 'creada',
    status: 'cambio de estado',
    pause: 'pausada',
    resume: 'reanudada',
    complete: 'completada',
    assign: 'asignada',
    unassign: 'sin asignar',
    priority: 'prioridad cambiada',
    parts: 'piezas actualizadas',
    convert: 'convertida desde incidencia'
};

/** Últimos movimientos: eventos de OT + comentarios de incidencias. */
export const getRecentActivity = (
    workOrders: WorkOrder[],
    incidents: Incident[],
    limit = 10
): ActivityEntry[] => {
    const entries: ActivityEntry[] = [];
    for (const wo of workOrders) {
        for (const ev of wo.events || []) {
            entries.push({
                id: `ev-${ev.id}`,
                kind: 'wo',
                refId: wo.id,
                title: wo.title,
                text: ev.note || WO_EVENT_TEXT[ev.kind] || ev.kind,
                actorName: ev.actorName || 'Sistema',
                createdAt: ev.createdAt
            });
        }
    }
    for (const inc of incidents) {
        for (const c of inc.comments || []) {
            entries.push({
                id: `c-${c.id}`,
                kind: 'incident',
                refId: inc.id,
                title: inc.title,
                text: c.text,
                actorName: c.userName || 'Sistema',
                createdAt: c.createdAt
            });
        }
    }
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return entries.slice(0, limit);
};
