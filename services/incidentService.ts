import { supabase } from '../lib/supabase';
import { Incident, IncidentComment, IncidentStatus, PaginationParams } from '../types';
import { mapIncident, mapIncidentComment } from '../utils/mappers';

export const incidentService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase
            .from('incidents')
            .select('*, comments:incident_comments(*), creator:profiles!created_by(name)')
            .order('created_at', { ascending: false });
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;

        if (error) throw error;
        return (data || []).map(mapIncident);
    },

    create: async (incident: Partial<Incident>) => {
        const { data, error } = await supabase
            .from('incidents')
            .insert([{
                title: incident.title,
                description: incident.description,
                priority: incident.priority,
                status: incident.status || IncidentStatus.OPEN,
                created_by: incident.createdBy,
                section: incident.section,
                equipment_id: incident.equipmentId || null,
                work_order_id: incident.workOrderId || null,
                attachments: incident.attachments || []
            }])
            .select('*, creator:profiles!created_by(name)')
            .single();

        if (error) throw error;
        return mapIncident(data);
    },

    update: async (id: string, updates: Partial<Incident>) => {
        const rawUpdates: any = {};
        if (updates.title !== undefined) rawUpdates.title = updates.title;
        if (updates.description !== undefined) rawUpdates.description = updates.description;
        if (updates.priority !== undefined) rawUpdates.priority = updates.priority;
        if (updates.status !== undefined) rawUpdates.status = updates.status;
        if (updates.equipmentId !== undefined) rawUpdates.equipment_id = updates.equipmentId;
        if (updates.workOrderId !== undefined) rawUpdates.work_order_id = updates.workOrderId;
        if (updates.attachments !== undefined) rawUpdates.attachments = updates.attachments;
        if (updates.section !== undefined) rawUpdates.section = updates.section;

        const { data, error } = await supabase
            .from('incidents')
            .update(rawUpdates)
            .eq('id', id)
            .select('*, creator:profiles!created_by(name)')
            .single();

        if (error) throw error;
        return mapIncident(data);
    },

    addComment: async (comment: Partial<IncidentComment>) => {
        const { data, error } = await supabase
            .from('incident_comments')
            .insert([{
                incident_id: comment.incidentId,
                user_id: comment.userId,
                user_name: comment.userName,
                text: comment.text,
                is_system: comment.isSystem || false,
                attachments: comment.attachments || []
            }])
            .select()
            .single();

        if (error) throw error;
        return mapIncidentComment(data);
    }
};
