import { supabase } from '../lib/supabase';
import { Incident, IncidentComment, IncidentStatus, PaginationParams } from '../types';
import { mapIncident, mapIncidentComment } from '../utils/mappers';

export const incidentService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase
            .from('incidents')
            .select('*, comments:incident_comments(*), creator:profiles!created_by(name), category:category_id(name), resolver:resolved_by(name)')
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
                // created_by lo pone la BD (DEFAULT auth.uid()); el RLS exige que coincida
                section: incident.section || null,
                category_id: incident.categoryId || null,
                equipment_id: incident.equipmentId || null,
                work_order_id: incident.workOrderId || null,
                attachments: incident.attachments || []
            }])
            .select('*, creator:profiles!created_by(name), category:category_id(name), resolver:resolved_by(name)')
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
        if (updates.categoryId !== undefined) rawUpdates.category_id = updates.categoryId;
        if (updates.reason !== undefined) rawUpdates.reason = updates.reason;
        if (updates.solution !== undefined) rawUpdates.solution = updates.solution;
        if (updates.resolvedAt !== undefined) rawUpdates.resolved_at = updates.resolvedAt;
        if (updates.resolvedBy !== undefined) rawUpdates.resolved_by = updates.resolvedBy;
        if (updates.equipmentId !== undefined) rawUpdates.equipment_id = updates.equipmentId;
        if (updates.workOrderId !== undefined) rawUpdates.work_order_id = updates.workOrderId;
        if (updates.attachments !== undefined) rawUpdates.attachments = updates.attachments;
        if (updates.section !== undefined) rawUpdates.section = updates.section;

        const { data, error } = await supabase
            .from('incidents')
            .update(rawUpdates)
            .eq('id', id)
            .select('*, creator:profiles!created_by(name), category:category_id(name), resolver:resolved_by(name)')
            .single();

        if (error) throw error;
        return mapIncident(data);
    },

    addComment: async (comment: Partial<IncidentComment>) => {
        // user_id y user_name los pone la BD (DEFAULT auth.uid() + trigger
        // fill_user_name); is_system conserva el nombre 'Sistema'.
        const { data, error } = await supabase
            .from('incident_comments')
            .insert([{
                incident_id: comment.incidentId,
                text: comment.text,
                is_system: comment.isSystem || false,
                attachments: comment.attachments || []
            }])
            .select()
            .single();

        if (error) throw error;
        return mapIncidentComment(data);
    },

    /** Transición de estado atómica (valida motivo/solución y sella resolved_*). */
    transition: async (id: string, status: string, reason?: string | null, solution?: string | null, comment?: string) => {
        const { error } = await supabase.rpc('transition_incident', {
            p_id: id,
            p_status: status,
            p_reason: reason ?? null,
            p_solution: solution ?? null,
            p_comment: comment ?? null
        });
        if (error) throw error;
    },

    /** Conversión a OT atómica e idempotente. Devuelve el id de la OT. */
    convertToWorkOrder: async (incidentId: string, payload: {
        title: string;
        section: string;
        description?: string | null;
        type?: string;
        priority?: string;
        equipmentId?: string | null;
        assignedUserId?: string | null;
        scheduledDate?: string | null;
        subtasks?: unknown[];
        attachments?: unknown[];
    }) => {
        const { data, error } = await supabase.rpc('convert_incident_to_wo', {
            p_incident_id: incidentId,
            p_title: payload.title,
            p_section: payload.section,
            p_description: payload.description ?? null,
            p_wo_type: payload.type ?? 'Correctivo',
            p_priority: payload.priority ?? 'Media',
            p_equipment_id: payload.equipmentId,
            p_assigned_user_id: payload.assignedUserId ?? null,
            p_scheduled_date: payload.scheduledDate ?? null,
            p_subtasks: payload.subtasks ?? [],
            p_attachments: payload.attachments ?? []
        });
        if (error) throw error;
        return data as string;
    },

    /**
     * Crea la incidencia y, opcionalmente, su parada de equipo en una única
     * transacción. Devuelve { incidentId, stoppageId }.
     */
    createWithStoppage: async (payload: {
        title: string;
        description: string;
        priority: string;
        categoryId: string;
        section?: string | null;
        equipmentId: string;
        attachments?: unknown[];
        withStoppage?: boolean;
        stoppageTitle?: string | null;
        stoppageStartAt?: string | null;
        stoppageDescription?: string | null;
    }) => {
        const { data, error } = await supabase.rpc('create_incident_with_stoppage', {
            p_title: payload.title,
            p_description: payload.description,
            p_priority: payload.priority,
            p_category_id: payload.categoryId,
            p_section: payload.section ?? null,
            p_equipment_id: payload.equipmentId ?? null,
            p_attachments: payload.attachments ?? [],
            p_with_stoppage: payload.withStoppage ?? false,
            p_stoppage_title: payload.stoppageTitle ?? null,
            p_stoppage_start_at: payload.stoppageStartAt ?? null,
            p_stoppage_description: payload.stoppageDescription ?? null
        });
        if (error) throw error;
        return {
            incidentId: (data as any)?.incident_id as string,
            stoppageId: ((data as any)?.stoppage_id ?? null) as string | null
        };
    }
};
