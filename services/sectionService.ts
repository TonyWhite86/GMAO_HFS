import { supabase } from '../lib/supabase';
import { Section, PaginationParams } from '../types';
import { mapSection } from '../utils/mappers';

export const sectionService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase.from('sections').select('*');
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        query = query.order('name');
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapSection);
    },

    create: async (section: Partial<Section>) => {
        const { data, error } = await supabase.from('sections').insert([{
            name: section.name,
            is_special: section.isSpecial,
            is_wildcard: section.isWildcard ?? false
        }]).select().single();

        if (error) throw error;
        return mapSection(data);
    },

    update: async (section: Section) => {
        const { data, error } = await supabase
            .from('sections')
            .update({
                name: section.name,
                is_special: section.isSpecial,
                is_wildcard: section.isWildcard
            })
            .eq('id', section.id)
            .select()
            .single();
        if (error) throw error;
        return mapSection(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('sections').delete().eq('id', id);
        if (error) throw error;
        return id;
    }
};
