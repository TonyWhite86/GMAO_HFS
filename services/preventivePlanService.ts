import { supabase } from '../lib/supabase';
import { PreventivePlan, PaginationParams } from '../types';
import { mapPreventivePlan } from '../utils/mappers';

export const preventivePlanService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase.from('preventive_plans').select('*');
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapPreventivePlan);
    },

    create: async (plan: PreventivePlan) => {
        const { data, error } = await supabase.from('preventive_plans').insert([{
            id: plan.id,
            name: plan.name,
            description: plan.description,
            equipment_id: plan.equipmentId,
            frequency_days: plan.frequencyDays,
            last_run: plan.lastRun,
            next_run: plan.nextRun,
            tasks: plan.tasks,
            section: plan.section
        }]).select().single();

        if (error) throw error;
        return mapPreventivePlan(data);
    },

    update: async (plan: PreventivePlan) => {
        const { data, error } = await supabase
            .from('preventive_plans')
            .update({
                name: plan.name,
                description: plan.description,
                equipment_id: plan.equipmentId,
                frequency_days: plan.frequencyDays,
                last_run: plan.lastRun,
                next_run: plan.nextRun,
                tasks: plan.tasks,
                section: plan.section
            })
            .eq('id', plan.id)
            .select()
            .single();
        if (error) throw error;
        return mapPreventivePlan(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('preventive_plans').delete().eq('id', id);
        if (error) throw error;
        return id;
    },

    updateDates: async (id: string, lastRun: string, nextRun: string) => {
        const { data, error } = await supabase
            .from('preventive_plans')
            .update({
                last_run: lastRun,
                next_run: nextRun
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapPreventivePlan(data);
    }
};
