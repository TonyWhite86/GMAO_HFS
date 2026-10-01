import { supabase } from '../lib/supabase';
import { UserPermission, PermissionLevel } from '../types';
import { mapUserPermission } from '../utils/mappers';

export const permissionService = {
    getAll: async (): Promise<UserPermission[]> => {
        const { data, error } = await supabase.from('user_permissions').select('*');
        if (error) throw error;
        return (data || []).map(mapUserPermission);
    },

    getByUser: async (userId: string): Promise<UserPermission[]> => {
        const { data, error } = await supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return (data || []).map(mapUserPermission);
    },

    setPermission: async (userId: string, module: string, level: PermissionLevel): Promise<UserPermission> => {
        const { data, error } = await supabase
            .from('user_permissions')
            .upsert({
                user_id: userId,
                module,
                level
            }, { onConflict: 'user_id,module' })
            .select()
            .single();
        if (error) throw error;
        return mapUserPermission(data);
    },

    deletePermission: async (id: string): Promise<void> => {
        const { error } = await supabase.from('user_permissions').delete().eq('id', id);
        if (error) throw error;
    },

    copyFromUser: async (fromUserId: string, toUserId: string): Promise<UserPermission[]> => {
        const sourcePermissions = await permissionService.getByUser(fromUserId);
        const inserts = sourcePermissions.map(p => ({
            user_id: toUserId,
            module: p.module,
            level: p.level
        }));
        if (inserts.length === 0) return [];
        const { data, error } = await supabase
            .from('user_permissions')
            .upsert(inserts, { onConflict: 'user_id,module' })
            .select();
        if (error) throw error;
        return (data || []).map(mapUserPermission);
    }
};
