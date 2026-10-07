import { supabase } from '../lib/supabase';
import { EquipmentStoppage } from '../types';
import { mapEquipmentStoppage } from '../utils/mappers';

const SELECT = '*, equipment:equipment_id(name), requester:requested_by(name), incident:incident_id(category:category_id(name))';

export const stoppageService = {
    getAll: async () => {
        const { data, error } = await supabase
            .from('equipment_stoppages')
            .select(SELECT)
            .order('start_at', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapEquipmentStoppage);
    },

    create: async (stoppage: Partial<EquipmentStoppage>) => {
        const { data, error } = await supabase
            .from('equipment_stoppages')
            .insert([{
                equipment_id: stoppage.equipmentId,
                title: stoppage.title,
                description: stoppage.description || null,
                reason_type: stoppage.reasonType,
                start_at: stoppage.startAt,
                end_at: stoppage.endAt,
                status: stoppage.status,
                work_order_id: stoppage.workOrderId || null
                // requested_by / created_by los pone la BD (DEFAULT auth.uid())
            }])
            .select(SELECT)
            .single();
        if (error) throw error;
        return mapEquipmentStoppage(data);
    },

    update: async (id: string, updates: Partial<EquipmentStoppage>) => {
        const payload: Record<string, unknown> = {};
        if (updates.equipmentId !== undefined) payload.equipment_id = updates.equipmentId;
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.reasonType !== undefined) payload.reason_type = updates.reasonType;
        if (updates.startAt !== undefined) payload.start_at = updates.startAt;
        if (updates.endAt !== undefined) payload.end_at = updates.endAt;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.requestedBy !== undefined) payload.requested_by = updates.requestedBy;
        if (updates.workOrderId !== undefined) payload.work_order_id = updates.workOrderId;

        const { data, error } = await supabase
            .from('equipment_stoppages')
            .update(payload)
            .eq('id', id)
            .select(SELECT)
            .single();
        if (error) throw error;
        return mapEquipmentStoppage(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('equipment_stoppages').delete().eq('id', id);
        if (error) throw error;
        return id;
    },

    /** Cierra una parada abierta fijando el fin (default: ahora). */
    complete: async (id: string, endAt?: string | null, status: string = 'Completada') => {
        const { error } = await supabase.rpc('complete_stoppage', {
            p_id: id,
            p_end_at: endAt ?? null,
            p_status: status
        });
        if (error) throw error;
    }
};
