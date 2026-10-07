import { supabase } from '../lib/supabase';

/**
 * Vistas de reporting creadas en `database/hfs_phase_g.sql` §3.
 * Centralizan los agregados que antes se calculaban en el cliente, para que
 * los números coincidan siempre y no dependan de lo que tenga el store.
 */
export interface WorkerStatRow {
    workerId: string;
    workerName: string;
    workerRole: string;
    completedCount: number;
    totalMinutes: number;
    avgMinutes: number;
    manualMinutes: number;
}

export interface EquipmentStatRow {
    equipmentId: string;
    equipmentName: string;
    totalCount: number;
    correctiveCount: number;
    totalMinutes: number;
    partsCost: number;
}

export interface PartRotationRow {
    itemId: string;
    itemName: string;
    sku: string;
    totalUsed: number;
    workOrdersCount: number;
}

export interface IncidentStatRow {
    total: number;
    openCount: number;
    inReviewCount: number;
    resolvedCount: number;
    cancelledCount: number;
    convertedCount: number;
    reasonsFilled: number;
    solutionsFilled: number;
    resolutionRate: number;
    avgResolutionDays: number | null;
}

const snake = (r: any) => ({
    workerId: r.worker_id,
    workerName: r.worker_name,
    workerRole: r.worker_role,
    completedCount: Number(r.completed_count) || 0,
    totalMinutes: Number(r.total_minutes) || 0,
    avgMinutes: Number(r.avg_minutes) || 0,
    manualMinutes: Number(r.manual_minutes) || 0
});

export const reportService = {
    /** Pestaña "Personal" de Informes. */
    getWorkerStats: async (): Promise<WorkerStatRow[]> => {
        const { data, error } = await supabase.from('report_worker_stats').select('*');
        if (error) throw error;
        return (data || []).map(snake);
    },

    /** Pestaña "Equipos" de Informes. */
    getEquipmentStats: async (): Promise<EquipmentStatRow[]> => {
        const { data, error } = await supabase.from('report_equipment_stats').select('*');
        if (error) throw error;
        return (data || []).map((r: any) => ({
            equipmentId: r.equipment_id,
            equipmentName: r.equipment_name,
            totalCount: Number(r.total_count) || 0,
            correctiveCount: Number(r.corrective_count) || 0,
            totalMinutes: Number(r.total_minutes) || 0,
            partsCost: Number(r.parts_cost) || 0
        }));
    },

    /** Rotación de repuestos. */
    getPartRotation: async (): Promise<PartRotationRow[]> => {
        const { data, error } = await supabase.from('report_part_rotation').select('*');
        if (error) throw error;
        return (data || []).map((r: any) => ({
            itemId: r.item_id,
            itemName: r.item_name,
            sku: r.sku,
            totalUsed: Number(r.total_used) || 0,
            workOrdersCount: Number(r.work_orders_count) || 0
        }));
    },

    /** Estadísticas de incidencias agrupadas por categoría. */
    getIncidentStatsByCategory: async (): Promise<(IncidentStatRow & { categoryId: string | null })[]> => {
        const { data, error } = await supabase.from('report_incident_stats_by_category').select('*');
        if (error) throw error;
        return (data || []).map((r: any) => ({
            categoryId: r.category_id ?? null,
            total: Number(r.total) || 0,
            openCount: Number(r.open_count) || 0,
            inReviewCount: Number(r.in_review_count) || 0,
            resolvedCount: Number(r.resolved_count) || 0,
            cancelledCount: Number(r.cancelled_count) || 0,
            convertedCount: Number(r.converted_count) || 0,
            reasonsFilled: Number(r.reasons_filled) || 0,
            solutionsFilled: Number(r.solutions_filled) || 0,
            resolutionRate: Number(r.resolution_rate) || 0,
            avgResolutionDays: r.avg_resolution_days === null ? null : Number(r.avg_resolution_days)
        }));
    },

    /** Estadísticas de incidencias (una sola fila). */
    getIncidentStats: async (): Promise<IncidentStatRow | null> => {
        const { data, error } = await supabase.from('report_incident_stats').select('*').maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return {
            total: Number(data.total) || 0,
            openCount: Number(data.open_count) || 0,
            inReviewCount: Number(data.in_review_count) || 0,
            resolvedCount: Number(data.resolved_count) || 0,
            cancelledCount: Number(data.cancelled_count) || 0,
            convertedCount: Number(data.converted_count) || 0,
            reasonsFilled: Number(data.reasons_filled) || 0,
            solutionsFilled: Number(data.solutions_filled) || 0,
            resolutionRate: Number(data.resolution_rate) || 0,
            avgResolutionDays: data.avg_resolution_days === null ? null : Number(data.avg_resolution_days)
        };
    }
};
