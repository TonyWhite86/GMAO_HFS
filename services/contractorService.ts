import { supabase } from '../lib/supabase';
import { Contractor } from '../types';
import { mapContractor } from '../utils/mappers';

export const contractorService = {
    getAll: async (): Promise<Contractor[]> => {
        const { data, error } = await supabase
            .from('contractors')
            .select('*')
            .order('name');
        if (error) throw error;
        return (data || []).map(mapContractor);
    },

    create: async (contractor: Partial<Contractor>): Promise<Contractor> => {
        const { data, error } = await supabase
            .from('contractors')
            .insert([{
                name: contractor.name,
                contact: contractor.contact ?? null,
                phone: contractor.phone ?? null,
                email: contractor.email ?? null,
                notes: contractor.notes ?? null,
                active: contractor.active ?? true
            }])
            .select()
            .single();
        if (error) throw error;
        return mapContractor(data);
    },

    update: async (id: string, updates: Partial<Contractor>): Promise<Contractor> => {
        const raw: any = {};
        if (updates.name !== undefined) raw.name = updates.name;
        if (updates.contact !== undefined) raw.contact = updates.contact;
        if (updates.phone !== undefined) raw.phone = updates.phone;
        if (updates.email !== undefined) raw.email = updates.email;
        if (updates.notes !== undefined) raw.notes = updates.notes;
        if (updates.active !== undefined) raw.active = updates.active;

        const { data, error } = await supabase
            .from('contractors')
            .update(raw)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapContractor(data);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('contractors')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
