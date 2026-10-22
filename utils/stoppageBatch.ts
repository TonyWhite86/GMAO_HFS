import { Equipment, EquipmentGroup } from '../types';

/** Cómo se elige el alcance de una parada de lote. */
export type StoppageScope =
    | { kind: 'single'; equipmentId: string }
    | { kind: 'multiple'; equipmentIds: string[] }
    | { kind: 'group'; groupId: string }
    | { kind: 'location'; location: string }
    | { kind: 'plant' };

/** Los equipos en baja/inactivos no entran en un lote (no están operativos). */
const isCandidate = (eq: Equipment): boolean =>
    eq.status !== 'Baja' && eq.status !== 'Inactivo';

/**
 * Expande el alcance de una parada de lote a la lista de equipos afectados.
 * Deduplica y ordena alfabéticamente para que el lote sea determinista.
 */
export const expandStoppageScope = (
    equipment: Equipment[],
    scope: StoppageScope,
    groups: EquipmentGroup[] = []
): string[] => {
    let ids: string[] = [];
    switch (scope.kind) {
        case 'single':
            ids = [scope.equipmentId];
            break;
        case 'multiple':
            ids = scope.equipmentIds;
            break;
        case 'group': {
            const group = groups.find(g => g.id === scope.groupId);
            ids = group ? group.equipmentIds : [];
            break;
        }
        case 'location':
            ids = equipment
                .filter(eq => eq.location === scope.location)
                .map(eq => eq.id);
            break;
        case 'plant':
            ids = equipment.map(eq => eq.id);
            break;
    }
    const wanted = new Set(ids);
    return equipment
        .filter(eq => wanted.has(eq.id) && isCandidate(eq))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map(eq => eq.id);
};

/** Nombre legible del alcance, para la vista previa del modal. */
export const describeStoppageScope = (scope: StoppageScope): string => {
    switch (scope.kind) {
        case 'single': return 'Un equipo';
        case 'multiple': return `${scope.equipmentIds.length} equipos elegidos`;
        case 'group': return 'Grupo';
        case 'location': return `Ubicación: ${scope.location}`;
        case 'plant': return 'Toda la planta';
    }
};
