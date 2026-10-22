import { Incident, IncidentCategory, Section, User, UserRole } from '../types';

/** Los observadores son los más limitados: nunca caen en el comodín. */
export const isObserver = (user: Pick<User, 'role'> | null | undefined): boolean =>
    user?.role === UserRole.OBSERVER_L1 || user?.role === UserRole.OBSERVER_L2;

/**
 * ¿Está el usuario en una sección comodín (Mantenimiento / Ingeniería)?
 * Un observador nunca es comodín, aunque esté apuntado a una sección comodín.
 */
export const isWildcardUser = (
    user: Pick<User, 'role' | 'sections'> | null | undefined,
    sections: Pick<Section, 'name' | 'isWildcard'>[] | null | undefined
): boolean => {
    if (!user || isObserver(user)) return false;
    if (!sections || sections.length === 0) return false;
    return user.sections.some(name => sections.find(s => s.name === name)?.isWildcard);
};

/**
 * Capa CATEGORÍA de la visibilidad de incidencia:
 * - El Admin ve todo.
 * - Categoría sin restricción (listas vacías) = visible para todos.
 * - Con valores: solo usuarios con alguna de esas secciones o alguno de esos roles.
 */
export const canViewIncidentCategory = (
    category: Pick<IncidentCategory, 'visibleSections' | 'visibleRoles'> | null | undefined,
    user: Pick<User, 'role' | 'sections'> | null | undefined
): boolean => {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    if (!category) return true;

    const { visibleSections = [], visibleRoles = [] } = category;
    if (visibleSections.length === 0 && visibleRoles.length === 0) return true;

    if (visibleRoles.includes(user.role)) return true;
    return visibleSections.some(section => user.sections.includes(section));
};

/**
 * Regla completa de visibilidad de una incidencia (espejo de
 * `incident_visible_to_me(section, category_id)` en `hfs_phase_d.sql`).
 *
 *   1. Admin            -> sí
 *   2. Comodín          -> sí (Mantenimiento/Ingeniería, nunca observadores)
 *   3. Capa SECCIÓN     -> section vacía/'Global' pasa; si no, la sección debe
 *                          estar en `user.sections`
 *   4. Capa CATEGORÍA   -> Y lógico con la 3
 */
export const canSeeIncident = (
    incident: Pick<Incident, 'section' | 'categoryId'> | null | undefined,
    user: Pick<User, 'role' | 'sections'> | null | undefined,
    categories: Pick<IncidentCategory, 'id' | 'visibleSections' | 'visibleRoles'>[] = [],
    sections: Pick<Section, 'name' | 'isWildcard'>[] = []
): boolean => {
    if (!incident || !user) return false;
    if (user.role === UserRole.ADMIN) return true;
    if (isWildcardUser(user, sections)) return true;

    // 3. Capa sección: sin sección = visible para todo el mundo
    const sec = incident.section;
    if (sec && sec !== 'Global' && !user.sections.includes(sec)) return false;

    // 4. Capa categoría (Y lógico)
    const category = incident.categoryId
        ? categories.find(c => c.id === incident.categoryId)
        : undefined;
    return canViewIncidentCategory(category, user);
};

/** ¿Puede gestionar (editar/transicionar) la incidencia?
 *  Admin | (Responsable Sección y la ve) | (comodín y la ve) */
export const canManageIncident = (
    incident: Pick<Incident, 'section' | 'categoryId'> | null | undefined,
    user: Pick<User, 'role' | 'sections'> | null | undefined,
    categories: Pick<IncidentCategory, 'id' | 'visibleSections' | 'visibleRoles'>[] = [],
    sections: Pick<Section, 'name' | 'isWildcard'>[] = []
): boolean => {
    if (!incident || !user) return false;
    if (user.role === UserRole.ADMIN) return true;
    if (!canSeeIncident(incident, user, categories, sections)) return false;
    return user.role === UserRole.SECTION_MANAGER || isWildcardUser(user, sections);
};

/** ¿Puede convertir la incidencia en una Orden de Trabajo?
 *  Solo Admin o personal de sección comodín (Mantenimiento/Ingeniería).
 *  Un observador nunca puede (isWildcardUser lo excluye).
 *  Espejo de `convert_incident_to_wo` en `database/hfs_all.sql`. */
export const canConvertIncident = (
    user: Pick<User, 'role' | 'sections'> | null | undefined,
    sections: Pick<Section, 'name' | 'isWildcard'>[] = []
): boolean => {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    return isWildcardUser(user, sections);
};

/**
 * ¿Puede recibir asignación de esta OT?
 * Espejo de `assign_work_order` en `database/hfs_all.sql`:
 *   · Observador                     → nunca
 *   · Admin                          → siempre
 *   · Comodín (Mantenimiento/Ingeniería) → siempre (gestionan todo)
 *   · Resto                          → su sección debe estar en la sección
 *                                      principal o en las colaboradoras
 *                                      ('Global' en cualquiera de las dos = sí)
 */
export const canBeAssignedToWO = (
    user: Pick<User, 'role' | 'sections'> | null | undefined,
    woSection: string | null | undefined,
    collaboratingSections: string[] | null | undefined = [],
    sections: Pick<Section, 'name' | 'isWildcard'>[] = []
): boolean => {
    if (!user) return false;
    if (isObserver(user)) return false;
    if (user.role === UserRole.ADMIN) return true;
    if (isWildcardUser(user, sections)) return true;

    const allowed = [woSection ?? '', ...(collaboratingSections || [])];
    if (allowed.includes('Global')) return true;
    return user.sections.some(sec => allowed.includes(sec));
};
