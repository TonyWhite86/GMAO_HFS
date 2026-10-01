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
