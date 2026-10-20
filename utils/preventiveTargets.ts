import { EquipmentGroup, PreventivePlanTarget } from '../types';

/** Entrada del editor de plan: equipos sueltos + grupos. */
export interface PlanTargetsInput {
    equipmentIds: string[];
    groupIds: string[];
    staggerDays?: number; // 0/undefined = todos a la vez
}

/**
 * Resuelve los equipos objetivo: sueltos + miembros de los grupos,
 * sin duplicados. Devuelve también el mapa grupo → miembros.
 */
export const expandTargetEquipment = (
    input: Pick<PlanTargetsInput, 'equipmentIds' | 'groupIds'>,
    groups: Pick<EquipmentGroup, 'id' | 'equipmentIds'>[]
): { equipmentIds: string[]; byGroup: Record<string, string[]> } => {
    const byGroup: Record<string, string[]> = {};
    const seen = new Set<string>();
    const equipmentIds: string[] = [];

    for (const id of input.equipmentIds) {
        if (!seen.has(id)) {
            seen.add(id);
            equipmentIds.push(id);
        }
    }
    for (const gid of input.groupIds) {
        const members = groups.find(g => g.id === gid)?.equipmentIds || [];
        byGroup[gid] = members;
        for (const id of members) {
            if (!seen.has(id)) {
                seen.add(id);
                equipmentIds.push(id);
            }
        }
    }
    return { equipmentIds, byGroup };
};

/** Fechas de arranque: todas a la vez o escalonadas cada `staggerDays` días. */
export const staggerStartDates = (count: number, staggerDays = 0, base: Date = new Date()): string[] => {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i * Math.max(0, staggerDays));
        out.push(d.toISOString());
    }
    return out;
};

export interface PlanSummary {
    equipmentCount: number;      // equipos únicos
    groupNames: string[];        // nombres de los grupos asignados
    directCount: number;         // equipos sueltos (sin grupo)
    overdueCount: number;        // objetivos vencidos
    nextRun: string | null;      // próximo vencimiento entre objetivos
}

/** Resumen de objetivos para la lista de planes. */
export const resolvePlanSummary = (
    targets: PreventivePlanTarget[],
    groups: Pick<EquipmentGroup, 'id' | 'name'>[],
    now: Date = new Date()
): PlanSummary => {
    const equipment = new Set(targets.map(t => t.equipmentId));
    const groupIds = [...new Set(targets.map(t => t.sourceGroupId).filter(Boolean))] as string[];
    const groupNames = groupIds
        .map(id => groups.find(g => g.id === id)?.name)
        .filter((n): n is string => !!n);
    const directCount = targets.filter(t => !t.sourceGroupId).length;
    const overdueCount = targets.filter(t => new Date(t.nextRun).getTime() <= now.getTime()).length;
    let nextRun: string | null = null;
    for (const t of targets) {
        if (!nextRun || new Date(t.nextRun).getTime() < new Date(nextRun).getTime()) nextRun = t.nextRun;
    }
    return { equipmentCount: equipment.size, groupNames, directCount, overdueCount, nextRun };
};
