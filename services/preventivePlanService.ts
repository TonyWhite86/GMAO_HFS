import { supabase } from '../lib/supabase';
import { PreventivePlan, EquipmentGroup, PaginationParams } from '../types';
import { mapPreventivePlan, mapEquipmentGroup } from '../utils/mappers';
import { PlanTargetsInput, expandTargetEquipment, staggerStartDates } from '../utils/preventiveTargets';

/**
 * Sincroniza los objetivos de un plan con la selección del editor:
 * grupos declarados (preventive_plan_groups) + objetivos materializados
 * (preventive_plan_targets) con arranque a la vez o escalonado.
 */
const syncTargets = async (planId: string, input: PlanTargetsInput) => {
    // 1. Grupos declarados del plan
    const { data: existingGroupRows, error: gErr } = await supabase
        .from('preventive_plan_groups')
        .select('group_id')
        .eq('plan_id', planId);
    if (gErr) throw gErr;
    const existingGroups = new Set((existingGroupRows || []).map(r => r.group_id as string));
    const desiredGroups = new Set(input.groupIds);

    const gInsert = [...desiredGroups].filter(g => !existingGroups.has(g))
        .map(g => ({ plan_id: planId, group_id: g }));
    if (gInsert.length > 0) {
        const { error } = await supabase.from('preventive_plan_groups').insert(gInsert);
        if (error) throw error;
    }
    for (const g of [...existingGroups].filter(g => !desiredGroups.has(g))) {
        const { error } = await supabase.from('preventive_plan_groups')
            .delete().eq('plan_id', planId).eq('group_id', g);
        if (error) throw error;
    }

    // 2. Expandir grupos → equipos objetivo
    const { data: groupRows, error: grpErr } = await supabase
        .from('equipment_groups')
        .select('*');
    if (grpErr) throw grpErr;
    const allGroups = (groupRows || []).map(mapEquipmentGroup);
    const { equipmentIds, byGroup } = expandTargetEquipment(input, allGroups);

    // 3. Objetivos actuales
    const { data: existingTargets, error: tErr } = await supabase
        .from('preventive_plan_targets')
        .select('*')
        .eq('plan_id', planId);
    if (tErr) throw tErr;
    const existing = existingTargets || [];

    // Bajas: directos ya no seleccionados, o de grupos ya no asignados
    for (const t of existing) {
        const keep = equipmentIds.includes(t.equipment_id)
            && (!t.source_group_id || input.groupIds.includes(t.source_group_id));
        if (!keep) {
            const { error } = await supabase.from('preventive_plan_targets').delete().eq('id', t.id);
            if (error) throw error;
        }
    }

    // Altas: equipos objetivo sin fila (los ciclos existentes se respetan)
    const keptEq = new Set(
        existing
            .filter(t => equipmentIds.includes(t.equipment_id)
                && (!t.source_group_id || input.groupIds.includes(t.source_group_id)))
            .map(t => t.equipment_id)
    );
    const missing = equipmentIds.filter(id => !keptEq.has(id));
    const starts = staggerStartDates(missing.length, input.staggerDays ?? 0);
    const rows = missing.map((eqId, i) => {
        const sourceGroupId = Object.entries(byGroup)
            .find(([, members]) => members.includes(eqId))?.[0] ?? null;
        return {
            plan_id: planId,
            equipment_id: eqId,
            source_group_id: sourceGroupId,
            next_run: starts[i]
        };
    });
    if (rows.length > 0) {
        const { error } = await supabase.from('preventive_plan_targets').insert(rows);
        if (error) throw error;
    }
};

export const preventivePlanService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase
            .from('preventive_plans')
            .select('*, targets:preventive_plan_targets(*)');
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((p: any) => mapPreventivePlan(p));
    },

    create: async (plan: PreventivePlan, targets?: PlanTargetsInput): Promise<PreventivePlan> => {
        const { data, error } = await supabase.from('preventive_plans').insert([{
            id: plan.id,
            name: plan.name,
            description: plan.description,
            frequency_days: plan.frequencyDays,
            last_run: plan.lastRun ?? null,
            next_run: plan.nextRun,
            tasks: plan.tasks,
            section: plan.section,
            collaborating_sections: plan.collaboratingSections || [],
            collaborators: plan.collaborators || [],
            assigned_user_id: plan.assignedUserId ?? null
        }]).select().single();

        if (error) throw error;
        if (targets) await syncTargets(plan.id, targets);
        return mapPreventivePlan(data);
    },

    update: async (plan: PreventivePlan, targets?: PlanTargetsInput): Promise<PreventivePlan> => {
        const { data, error } = await supabase
            .from('preventive_plans')
            .update({
                name: plan.name,
                description: plan.description,
                frequency_days: plan.frequencyDays,
                last_run: plan.lastRun ?? null,
                next_run: plan.nextRun,
                tasks: plan.tasks,
                section: plan.section,
                collaborating_sections: plan.collaboratingSections || [],
                collaborators: plan.collaborators || [],
                assigned_user_id: plan.assignedUserId ?? null
            })
            .eq('id', plan.id)
            .select()
            .single();
        if (error) throw error;
        if (targets) await syncTargets(plan.id, targets);
        return mapPreventivePlan(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('preventive_plans').delete().eq('id', id);
        if (error) throw error;
        return id;
    },

    /** Ajuste manual del ciclo de un objetivo concreto. */
    updateTarget: async (targetId: string, nextRun: string) => {
        const { error } = await supabase
            .from('preventive_plan_targets')
            .update({ next_run: nextRun })
            .eq('id', targetId);
        if (error) throw error;
    },

    /** Lanzar el plan ahora: una OT por cada objetivo (el motor rueda sus ciclos). */
    launchPlan: async (planId: string): Promise<void> => {
        const { error } = await supabase.rpc('launch_plan_next_wo', {
            p_plan_id: planId
        });
        if (error) throw error;
    }
};
