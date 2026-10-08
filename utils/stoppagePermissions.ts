import { EquipmentStoppage, StoppageStatus, User, UserRole } from '../types';

const isOpenStoppage = (st: Pick<EquipmentStoppage, 'status'>) =>
    st.status !== StoppageStatus.COMPLETED && st.status !== StoppageStatus.CANCELLED;

/**
 * ¿Puede gestionar (editar / transicionar) ESTA parada?
 * Espejo de `can_manage_stoppage(id)` en `database/hfs_phase_g3.sql`.
 *
 *   · Admin                     → sí, siempre
 *   · Creador de la parada      → sí, pero sólo si está abierta
 *   · Resto                     → no
 *
 * El permiso 'paradas' = 'total' ya NO otorga gestión: sólo controla si ves o
 * no el calendario.
 */
export const canManageStoppage = (
    st: Pick<EquipmentStoppage, 'createdBy' | 'status'>,
    user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;
    return st.createdBy === user.id && isOpenStoppage(st);
};

/**
 * ¿Puede ELIMINAR esta parada?
 * Espejo de `can_delete_stoppage(id)` en `database/hfs_phase_g3.sql`.
 *
 *   · Si viene de una incidencia → NADIE (sólo se puede cerrar)
 *   · Si ya está cerrada         → sólo Admin
 *   · Si está abierta y sin inc. → Admin o creador
 */
export const canDeleteStoppage = (
    st: Pick<EquipmentStoppage, 'createdBy' | 'status' | 'incidentId'>,
    user: Pick<User, 'id' | 'role'> | null | undefined
): boolean => {
    if (!user) return false;
    if (st.incidentId) return false;
    if (!isOpenStoppage(st)) return user.role === UserRole.ADMIN;
    return user.role === UserRole.ADMIN || st.createdBy === user.id;
};
