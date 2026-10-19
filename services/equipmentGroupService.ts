import { supabase } from '../lib/supabase';
import { EquipmentGroup } from '../types';
import { mapEquipmentGroup } from '../utils/mappers';

export const equipmentGroupService = {
    getAll: async (): Promise<EquipmentGroup[]> => {
        const { data, error } = await supabase
            .from('equipment_groups')
            .select('*')
            .order('name');
        if (error) throw error;
        return (data || []).map(mapEquipmentGroup);
    },

    create: async (group: Partial<EquipmentGroup>): Promise<EquipmentGroup> => {
        const { data, error } = await supabase
            .from('equipment_groups')
            .insert([{
                name: group.name,
                description: group.description ?? null,
                equipment_ids: group.equipmentIds ?? [],
                active: group.active ?? true
            }])
            .select()
            .single();
        if (error) throw error;
        return mapEquipmentGroup(data);
    },

    update: async (id: string, updates: Partial<EquipmentGroup>): Promise<EquipmentGroup> => {
        const raw: any = {};
        if (updates.name !== undefined) raw.name = updates.name;
        if (updates.description !== undefined) raw.description = updates.description;
        if (updates.equipmentIds !== undefined) raw.equipment_ids = updates.equipmentIds;
        if (updates.active !== undefined) raw.active = updates.active;

        const { data, error } = await supabase
            .from('equipment_groups')
            .update(raw)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapEquipmentGroup(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('equipment_groups')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
