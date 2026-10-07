import { supabase } from '../lib/supabase';
import { WorkOrder, Comment, SubTask, Attachment, PaginationParams } from '../types';
import { mapWorkOrder } from '../utils/mappers';

export const workOrderService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase
            .from('work_orders')
            .select('*, comments(*), subtasks(*), events:work_order_events(*)')
            .order('created_at', { ascending: false });
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;

        if (error) throw error;

        // Fetch all attachments for work orders in one go (more efficient than N queries)
        const { data: allAttachments } = await supabase
            .from('attachments')
            .select('*')
            .eq('parent_type', 'work_order');

        return (data || []).map(wo => mapWorkOrder(wo, allAttachments || []));
    },

    getByRelatedIncidentId: async (incidentId: string) => {
        const { data, error } = await supabase
            .from('work_orders')
            .select('id')
            .eq('related_incident_id', incidentId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    create: async (wo: WorkOrder) => {
        // Clean object for DB insertion (remove expanded relations)
        const woToInsert = {
            id: wo.id,
            title: wo.title,
            description: wo.description,
            type: wo.type,
            status: wo.status,
            priority: wo.priority,
            equipment_id: wo.equipmentId || null,
            assigned_user_id: wo.assignedUserId || null,
            collaborators: wo.collaborators || [],
            section: wo.section,
            // created_by lo pone la BD (DEFAULT auth.uid()); el RLS lo exige
            created_at: wo.createdAt,
            scheduled_date: wo.scheduledDate || null,
            closed_at: wo.closedAt || null,
            time_spent_minutes: wo.timeSpentMinutes || 0,
            pending_reason: wo.pendingReason || null,
            audio_note_url: wo.audioNoteUrl || null,
            status_history: wo.statusHistory || [],
            collaborating_sections: wo.collaboratingSections || [],
            used_parts: wo.usedParts || [],
            related_plan_id: wo.relatedPlanId || null,
            related_incident_id: wo.relatedIncidentId || null
        };

        const { data: woData, error: woError } = await supabase
            .from('work_orders')
            .insert([woToInsert])
            .select()
            .single();

        if (woError) throw woError;
        const newWOId = woData.id;

        // Insert Subtasks
        if (wo.subtasks && wo.subtasks.length > 0) {
            const subtasksToInsert = wo.subtasks.map((st: SubTask) => ({
                work_order_id: newWOId,
                description: st.description,
                completed: st.completed,
                assigned_user_ids: st.assignedUserIds
            }));

            const { error: stError } = await supabase.from('subtasks').insert(subtasksToInsert);
            if (stError) throw stError;
        }

        // Insert Attachments
        if (wo.attachments && wo.attachments.length > 0) {
            const attachmentsToInsert = wo.attachments.map((att: Attachment) => ({
                parent_id: newWOId,
                parent_type: 'work_order',
                name: att.name,
                url: att.url,
                type: att.type
            }));

            const { error: attError } = await supabase.from('attachments').insert(attachmentsToInsert);
            if (attError) throw attError;
        }

        return { ...wo, id: newWOId };
    },

    update: async (wo: WorkOrder) => {
        // status_history / time_spent_minutes / closed_at NO se envían: son
        // propiedad de transition_work_order (RPC) y del trigger
        // enforce_work_order_transition. Escribirlos desde aquí permitiría
        // reescribir el histórico de horas o reabrir una OT completada.
        // Tampoco se envía `status`: los cambios de estado pasan SIEMPRE por
        // transition_work_order / assign_work_order. Mandarlo aquí provocaba la
        // carrera "La orden ya está completada" que dejaba el tiempo a 0.
        const woToUpdate = {
            title: wo.title,
            description: wo.description,
            type: wo.type,
            priority: wo.priority,
            equipment_id: wo.equipmentId || null,
            assigned_user_id: wo.assignedUserId || null,
            collaborators: wo.collaborators || [],
            section: wo.section,
            scheduled_date: wo.scheduledDate || null,
            pending_reason: wo.pendingReason || null,
            audio_note_url: wo.audioNoteUrl || null,
            collaborating_sections: wo.collaboratingSections || [],
            used_parts: wo.usedParts || [],
            related_plan_id: wo.relatedPlanId || null,
            related_incident_id: wo.relatedIncidentId || null
        };

        const { data, error: woError } = await supabase
            .from('work_orders')
            .update(woToUpdate)
            .eq('id', wo.id)
            .select()
            .single();

        if (woError) throw woError;

        // Sync Attachments (Complex logic from useAppStore)
        if (wo.attachments && wo.attachments.length > 0) {
            // Get existing attachments from DB to compare
            const { data: existingAtts } = await supabase
                .from('attachments')
                .select('*')
                .eq('parent_id', wo.id)
                .eq('parent_type', 'work_order');

            const existingUrls = new Set((existingAtts || []).map(a => a.url));

            // Insert new ones
            const newAttachments = wo.attachments.filter(a => !existingUrls.has(a.url));
            if (newAttachments.length > 0) {
                const attachmentsToInsert = newAttachments.map(att => ({
                    parent_id: wo.id,
                    parent_type: 'work_order',
                    name: att.name,
                    url: att.url,
                    type: att.type
                }));
                await supabase.from('attachments').insert(attachmentsToInsert);
            }

            // Delete removed ones
            const currentUrls = new Set(wo.attachments.map(a => a.url));
            const attachmentsToDelete = (existingAtts || []).filter(a => !currentUrls.has(a.url));

            if (attachmentsToDelete.length > 0) {
                await supabase.from('attachments').delete().eq('parent_id', wo.id).eq('parent_type', 'work_order').in('url', attachmentsToDelete.map(a => a.url));
                // Also remove from storage
                const pathsToDelete = attachmentsToDelete.map(a => {
                    const parts = a.url.split('/');
                    return parts[parts.length - 1];
                });
                if (pathsToDelete.length > 0) {
                    await supabase.storage.from('work-order-files').remove(pathsToDelete);
                }
            }
        }

        return wo;
    },

    toggleSubtask: async (subtaskId: string, completed: boolean) => {
        const { data, error } = await supabase
            .from('subtasks')
            .update({ completed })
            .eq('id', subtaskId)
            .select()
            .single();
        if (error) throw error;
        return { id: subtaskId, completed };
    },

    addComment: async (comment: Comment, workOrderId: string) => {
        // user_id y user_name los pone la BD (DEFAULT auth.uid() + trigger
        // fill_user_name); is_system conserva el nombre 'Sistema'.
        const { data, error } = await supabase.from('comments').insert([{
            work_order_id: workOrderId,
            text: comment.text,
            is_system: comment.isSystem,
            status: comment.status,
            attachments: comment.attachments || [],
            created_at: comment.createdAt || new Date().toISOString()
        }]).select().single();

        if (error) throw error;
        return {
            ...comment,
            id: data.id,
            userId: data.user_id,
            userName: data.user_name,
            attachments: data.attachments || []
        };
    },

    /** Transición de estado atómica (start | pause | resume | complete). */
    transition: async (id: string, action: 'start' | 'pause' | 'resume' | 'complete', note?: string | null, manualMinutes?: number | null) => {
        const { error } = await supabase.rpc('transition_work_order', {
            p_id: id,
            p_action: action,
            p_note: note ?? null,
            p_manual_minutes: manualMinutes ?? null
        });
        if (error) throw error;
    },

    /** Asignación valida que el técnico pertenezca a la sección de la OT. */
    assign: async (id: string, userId: string, scheduledDate?: string | null, subtaskIds?: string[] | null, assignMain = true) => {
        const { error } = await supabase.rpc('assign_work_order', {
            p_wo_id: id,
            p_user_id: userId,
            p_scheduled_date: scheduledDate ?? null,
            p_subtask_ids: subtaskIds ?? null,
            p_assign_main: assignMain
        });
        if (error) throw error;
    },

    unassign: async (id: string, userId?: string | null) => {
        const { error } = await supabase.rpc('unassign_work_order', {
            p_wo_id: id,
            p_user_id: userId ?? null
        });
        if (error) throw error;
    }
};
