import { useMemo } from 'react';
import { User, IncidentCategory, Section } from '../types';
import { useAppStore } from '../store/useAppStore';
import { canViewIncidentCategory, isWildcardUser } from '../utils/incidentVisibility';

/**
 * Categorías de incidencia visibles para el usuario actual (visibilidad por
 * sección/rol). No filtra por `isActive`: cada consumidor decide si quiere
 * descartar las inactivas (crear) o conservarlas (informes históricos).
 *
 * El Admin y las secciones comodín (Mantenimiento/Ingeniería) ven todo el
 * catálogo; un observador nunca cae en el comodín.
 */
export const useVisibleCategories = (currentUser: User | null | undefined): IncidentCategory[] => {
    const incidentCategories = useAppStore(s => s.incidentCategories);
    const catalogSections = useAppStore(s => s.sections) as Section[];

    return useMemo(() => {
        if (!currentUser) return [];
        if (isWildcardUser(currentUser, catalogSections)) return incidentCategories;
        return incidentCategories.filter(c => canViewIncidentCategory(c, currentUser));
    }, [incidentCategories, currentUser, catalogSections]);
};
