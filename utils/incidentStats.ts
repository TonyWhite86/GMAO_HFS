import { Incident, IncidentStatus } from '../types';

export interface IncidentStats {
    total: number;
    open: number;
    inProgress: number;
    pausedMaterial: number;
    pausedBudget: number;
    pausedExternal: number;
    scheduled: number;
    pendingClose: number;
    closed: number;
    resolutionRate: number;
    avgResolutionDays: number | null;
}

export interface MonthlyCount {
    label: string;
    key: string;
    count: number;
}

export interface ValueCount {
    value: string;
    count: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const computeIncidentStats = (incidents: Incident[]): IncidentStats => {
    const total = incidents.length;
    let open = 0, inProgress = 0, pausedMaterial = 0, pausedBudget = 0, pausedExternal = 0;
    let scheduled = 0, pendingClose = 0, closed = 0;
    let resolutionDaysSum = 0;
    let resolvedWithDates = 0;

    for (const inc of incidents) {
        switch (inc.status) {
            case IncidentStatus.OPEN: open++; break;
            case IncidentStatus.IN_PROGRESS: inProgress++; break;
            case IncidentStatus.PAUSED_MATERIAL: pausedMaterial++; break;
            case IncidentStatus.PAUSED_BUDGET: pausedBudget++; break;
            case IncidentStatus.PAUSED_EXTERNAL: pausedExternal++; break;
            case IncidentStatus.SCHEDULED: scheduled++; break;
            case IncidentStatus.PENDING_CLOSE: pendingClose++; break;
            case IncidentStatus.CLOSED: closed++; break;
        }

        if (inc.resolvedAt && inc.createdAt) {
            const days = (new Date(inc.resolvedAt).getTime() - new Date(inc.createdAt).getTime()) / MS_PER_DAY;
            if (days >= 0) {
                resolutionDaysSum += days;
                resolvedWithDates++;
            }
        }
    }

    return {
        total,
        open,
        inProgress,
        pausedMaterial,
        pausedBudget,
        pausedExternal,
        scheduled,
        pendingClose,
        closed,
        resolutionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
        avgResolutionDays: resolvedWithDates > 0
            ? Math.round((resolutionDaysSum / resolvedWithDates) * 10) / 10
            : null
    };
};

/** Serie mensual de incidencias creadas (por defecto últimos 12 meses hasta `now`). */
export const computeMonthlySeries = (
    incidents: Incident[],
    now: Date = new Date(),
    months: number = 12
): MonthlyCount[] => {
    const buckets = new Map<string, MonthlyCount>();
    const order: MonthlyCount[] = [];

    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-ES', { month: 'short' });
        const bucket = { label, key, count: 0 };
        buckets.set(key, bucket);
        order.push(bucket);
    }

    for (const inc of incidents) {
        const d = new Date(inc.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.count++;
    }

    return order;
};

export const computeDistribution = (
    incidents: Incident[],
    getValue: (inc: Incident) => string
): ValueCount[] => {
    const counts = new Map<string, number>();
    for (const inc of incidents) {
        const value = getValue(inc) || 'Sin asignar';
        counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
};
