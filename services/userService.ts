import { supabase } from '../lib/supabase';
import { User, PaginationParams } from '../types';
import { mapProfile } from '../utils/mappers';

export const userService = {
    getAll: async (pagination?: PaginationParams) => {
        // profile_emails sólo es legible por Admin (RLS): los demás reciben NULL.
        let query = supabase.from('profiles').select('*, emails:profile_emails(email)');
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((d: any) => mapProfile(d));
    },

    create: async (user: User, password: string) => {
        const { data: newId, error } = await supabase.rpc('create_user_with_role', {
            new_email: user.email,
            new_password: password,
            new_role: user.role,
            new_name: user.name,
            new_sections: user.sections || []
        });
        if (error) throw error;

        if (user.avatar) {
            const { error: avatarError } = await supabase
                .from('profiles')
                .update({ avatar: user.avatar })
                .eq('id', newId);
            if (avatarError) throw avatarError;
        }

        const { data, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newId)
            .single();
        if (fetchError) throw fetchError;
        return mapProfile(data);
    },

    update: async (user: User) => {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                name: user.name,
                role: user.role,
                sections: user.sections,
                active: user.active,
                avatar: user.avatar
            })
            .eq('id', user.id)
            .select('*, emails:profile_emails(email)')
            .single();
        if (error) throw error;

        // El email vive en su propia tabla (RLS sólo-Admin)
        if (user.email) {
            await supabase
                .from('profile_emails')
                .upsert({ profile_id: user.id, email: user.email.toLowerCase().trim() });
        }
        return mapProfile(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.rpc('delete_user_with_role', { p_user_id: id });
        if (error) throw error;
        return id;
    }
};
