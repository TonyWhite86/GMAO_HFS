import { EquipmentStoppage, StoppageStatus } from '../types';
import { STOPPAGE_REASON_FALLBACK, STOPPAGE_REASON_CONFIG } from '../constants';
import { normalizeForSearch } from './searchUtils';

export interface StoppageFilters {
    equipmentId: string;      // '' = todos
    status: string;           // '' = todos (StoppageStatus)
    onlyOpenNow: boolean;     // solo paradas abiertas (equipo parado ahora)
    reason: string;           // '' = todas (etiqueta efectiva del motivo)
    origin: '' | 'incident' | 'manual';
    search: string;
}

export const EMPTY_STOPPAGE_FILTERS: StoppageFilters = {
    equipmentId: '',
    status: '',
    onlyOpenNow: false,
    reason: '',
    origin: '',
    search: ''
};

/** Parada abierta = sin fin y no cancelada (el equipo está detenido ahora mismo). */
export const isOpenNow = (s: EquipmentStoppage): boolean =>
    !s.endAt && s.status !== StoppageStatus.CANCELLED;

export const getOpenNow = (stoppages: EquipmentStoppage[]): EquipmentStoppage[] =>
    stoppages.filter(isOpenNow);

/** Motivo efectivo: categoría de la incidencia si la hay, si no el reasonType. */
export const getStoppageReasonLabel = (s: EquipmentStoppage): string =>
    s.reasonLabel
    || (s.reasonType && STOPPAGE_REASON_CONFIG[s.reasonType]?.label)
    || STOPPAGE_REASON_FALLBACK.label;

/** Etiquetas de motivo distintas presentes en los datos (para el desplegable). */
export const getReasonOptions = (stoppages: EquipmentStoppage[]): string[] =>
    [...new Set(stoppages.map(getStoppageReasonLabel))].sort((a, b) => a.localeCompare(b, 'es'));

export const filterStoppages = (
    stoppages: EquipmentStoppage[],
    filters: Partial<StoppageFilters> = {}
): EquipmentStoppage[] => {
    const f = { ...EMPTY_STOPPAGE_FILTERS, ...filters };
    const q = normalizeForSearch(f.search.trim());

    return stoppages.filter(s => {
        if (f.equipmentId && s.equipmentId !== f.equipmentId) return false;
        if (f.status && s.status !== f.status) return false;
        if (f.onlyOpenNow && !isOpenNow(s)) return false;
        if (f.reason && getStoppageReasonLabel(s) !== f.reason) return false;
        if (f.origin === 'incident' && !s.incidentId) return false;
        if (f.origin === 'manual' && s.incidentId) return false;
        if (q) {
            const hay = normalizeForSearch(`${s.title} ${s.description || ''}`);
            if (!hay.includes(q)) return false;
        }
        return true;
    });
};

/** ¿Hay algún filtro activo? (para chips, contador y "Limpiar") */
export const hasActiveFilters = (filters: Partial<StoppageFilters> = {}): boolean => {
    const f = { ...EMPTY_STOPPAGE_FILTERS, ...filters };
    return !!(f.equipmentId || f.status || f.onlyOpenNow || f.reason || f.origin || f.search.trim());
};
