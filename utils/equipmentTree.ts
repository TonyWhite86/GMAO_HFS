import { Equipment } from '../types';

export interface EquipmentTreeNode {
    equipment: Equipment;
    children: EquipmentTreeNode[];
}

const byName = (a: Equipment, b: Equipment) => a.name.localeCompare(b.name, 'es');

/** Raíces: equipos sin padre, o cuyo padre ya no existe en la lista. */
const rootIds = (equipment: Equipment[]): Set<string> => {
    const ids = new Set(equipment.map(e => e.id));
    return new Set(equipment.filter(e => !e.parentId || !ids.has(e.parentId)).map(e => e.id));
};

/**
 * Árbol jerárquico de equipos (por `parentId`), ordenado alfabéticamente en cada
 * nivel. Los equipos con padre ausente se tratan como raíces para no perderlos.
 */
export const buildEquipmentTree = (equipment: Equipment[]): EquipmentTreeNode[] => {
    const roots = rootIds(equipment);
    const byParent = new Map<string, Equipment[]>();
    for (const e of equipment) {
        const key = e.parentId && !roots.has(e.id) ? e.parentId : '';
        const list = byParent.get(key);
        if (list) list.push(e);
        else byParent.set(key, [e]);
    }

    const build = (parentId: string): EquipmentTreeNode[] =>
        (byParent.get(parentId) || [])
            .slice()
            .sort(byName)
            .map(equipment => ({
                equipment,
                children: build(equipment.id)
            }));

    return build('');
};

/** Cadenas de ancestros (del más lejano al padre directo) de un equipo. */
export const getAncestorIds = (equipment: Equipment[], id: string): string[] => {
    const byId = new Map(equipment.map(e => [e.id, e]));
    const chain: string[] = [];
    let current = byId.get(id)?.parentId;
    const seen = new Set<string>();
    while (current && byId.has(current) && !seen.has(current)) {
        seen.add(current);
        chain.unshift(current);
        current = byId.get(current)?.parentId;
    }
    return chain;
};

/** Ruta legible de un equipo: "Planta > Línea > Equipo". */
export const getEquipmentPath = (equipment: Equipment[], id: string): string => {
    const byId = new Map(equipment.map(e => [e.id, e]));
    const names: string[] = [];
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        names.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(' > ');
};

/** Ids a expandir por defecto: raíces + ancestros del seleccionado. */
export const defaultExpandedIds = (equipment: Equipment[], selectedId: string | null): Set<string> => {
    const expanded = new Set(rootIds(equipment));
    if (selectedId) {
        for (const id of getAncestorIds(equipment, selectedId)) expanded.add(id);
    }
    return expanded;
};
