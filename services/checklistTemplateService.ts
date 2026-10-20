import { supabase } from '../lib/supabase';
import { ChecklistTemplate } from '../types';
import { mapChecklistTemplate } from '../utils/mappers';

export const checklistTemplateService = {
    getAll: async (): Promise<ChecklistTemplate[]> => {
        const { data, error } = await supabase
            .from('checklist_templates')
            .select('*')
            .order('name');
        if (error) throw error;
        return (data || []).map(mapChecklistTemplate);
    },

    create: async (template: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> => {
        const { data, error } = await supabase
            .from('checklist_templates')
            .insert([{
                name: template.name,
                items: template.items ?? [],
                active: template.active ?? true
            }])
            .select()
            .single();
        if (error) throw error;
        return mapChecklistTemplate(data);
    },

    update: async (id: string, updates: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> => {
        const raw: any = {};
        if (updates.name !== undefined) raw.name = updates.name;
        if (updates.items !== undefined) raw.items = updates.items;
        if (updates.active !== undefined) raw.active = updates.active;

        const { data, error } = await supabase
            .from('checklist_templates')
            .update(raw)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapChecklistTemplate(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('checklist_templates')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
