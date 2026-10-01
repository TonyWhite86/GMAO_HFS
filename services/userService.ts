import { supabase } from '../lib/supabase';
import { User, PaginationParams } from '../types';
import { mapProfile } from '../utils/mappers';

export const userService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase.from('profiles').select('*');
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapProfile);
    },

    create: async (user: User) => {
        const { id: _unused, ...insertData } = user;
        const { data, error } = await supabase.from('profiles').insert([insertData]).select().single();
        if (error) throw error;
        return mapProfile(data);
    },

    update: async (user: User) => {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                name: user.name,
                email: user.email,
                role: user.role,
                sections: user.sections,
                active: user.active,
                avatar: user.avatar
            })
            .eq('id', user.id)
            .select()
            .single();
        if (error) throw error;
        return mapProfile(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        return id;
    }
};
