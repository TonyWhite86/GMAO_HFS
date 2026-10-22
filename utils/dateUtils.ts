export const toLocalDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const getMondayOfWeek = (date: Date): Date => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
};

export const getDaysToShow = (
    viewMode: 'day' | 'week',
    currentDate: Date,
    showSunday: boolean
): Date[] => {
    if (viewMode === 'day') return [new Date(currentDate)];

    const monday = getMondayOfWeek(currentDate);
    const daysCount = showSunday ? 7 : 6;
    return Array.from({ length: daysCount }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
};

export const navigateDate = (
    currentDate: Date,
    viewMode: 'day' | 'week',
    direction: 'prev' | 'next'
): Date => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    } else {
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    }
    return newDate;
};

export const formatHeaderLabel = (
    viewMode: 'day' | 'week',
    currentDate: Date,
    daysToShow: Date[]
): string => {
    if (viewMode === 'day') {
        return currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    const start = daysToShow[0];
    return `Semana del ${start.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
};

/**
 * ¿La OT cubre este día? (trabajo multi-día)
 * Empieza en scheduledDate (o createdAt) y termina en scheduledEndDate
 * (si no hay fin, dura solo el día de inicio).
 */
export const woSpansDay = (
    wo: { scheduledDate?: string | null; scheduledEndDate?: string | null; createdAt?: string },
    day: Date
): boolean => {
    const startStr = wo.scheduledDate || wo.createdAt;
    if (!startStr) return false;
    const dayStr = toLocalDateStr(day);
    const start = toLocalDateStr(new Date(startStr));
    const end = wo.scheduledEndDate ? toLocalDateStr(new Date(wo.scheduledEndDate)) : start;
    return dayStr >= start && dayStr <= end;
};

/** Etiqueta de rango «12–15 oct» (o solo «12 oct» si no hay fin / mismo día). */
export const formatDateRange = (startStr: string, endStr?: string | null): string => {
    const start = new Date(startStr);
    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
    if (!endStr) return fmt(start);
    const end = new Date(endStr);
    if (toLocalDateStr(start) === toLocalDateStr(end)) return fmt(start);
    return `${start.toLocaleDateString('es-ES', { day: 'numeric' })}–${fmt(end)}`;
};
