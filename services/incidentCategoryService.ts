import { supabase } from '../lib/supabase';
import { IncidentCategory } from '../types';
import { mapIncidentCategory } from '../utils/mappers';

export const incidentCategoryService = {
    getAll: async () => {
        const { data, error } = await supabase
            .from('incident_categories')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapIncidentCategory);
    },

    create: async (category: Partial<IncidentCategory>) => {
        const { data, error } = await supabase
            .from('incident_categories')
            .insert([{
                name: category.name,
                is_active: category.isActive ?? true,
                is_default: category.isDefault ?? false,
                sort_order: category.sortOrder ?? 0,
                visible_sections: category.visibleSections || [],
                visible_roles: category.visibleRoles || []
            }])
            .select()
            .single();
        if (error) throw error;
        return mapIncidentCategory(data);
    },

    update: async (id: string, updates: Partial<IncidentCategory>) => {
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.isDefault !== undefined) payload.is_default = updates.isDefault;
        if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
        if (updates.visibleSections !== undefined) payload.visible_sections = updates.visibleSections;
        if (updates.visibleRoles !== undefined) payload.visible_roles = updates.visibleRoles;

        const { data, error } = await supabase
            .from('incident_categories')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapIncidentCategory(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('incident_categories').delete().eq('id', id);
        if (error) throw error;
        return id;
    }
};
