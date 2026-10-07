import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportService } from './reportService';

vi.mock('../lib/supabase', () => ({
    supabase: { from: vi.fn(), rpc: vi.fn() }
}));

import { supabase } from '../lib/supabase';

const mockFrom = supabase.from as any;

function chain(data: any = [], single: any = null) {
    const c: any = {};
    c.select = vi.fn().mockReturnValue(c);
    c.eq = vi.fn().mockReturnValue(c);
    c.maybeSingle = vi.fn().mockResolvedValue({ data: single, error: null });
    c.then = (resolve: any) => Promise.resolve(resolve({ data, error: null }));
    return c;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('reportService', () => {
    it('getWorkerStats lee de report_worker_stats y convierte snake_case', async () => {
        const c = chain([{
            worker_id: 'u1', worker_name: 'Ana', worker_role: 'Técnico',
            completed_count: 4, total_minutes: 250, avg_minutes: 63, manual_minutes: 12
        }]);
        mockFrom.mockReturnValueOnce(c);

        const rows = await reportService.getWorkerStats();
        expect(mockFrom).toHaveBeenCalledWith('report_worker_stats');
        expect(rows[0]).toEqual({
            workerId: 'u1', workerName: 'Ana', workerRole: 'Técnico',
            completedCount: 4, totalMinutes: 250, avgMinutes: 63, manualMinutes: 12
        });
    });

    it('getEquipmentStats lee de report_equipment_stats', async () => {
        const c = chain([{
            equipment_id: 'e1', equipment_name: 'Torno',
            corrective_count: 2, total_minutes: 120, parts_cost: 45.5
        }]);
        mockFrom.mockReturnValueOnce(c);
        const rows = await reportService.getEquipmentStats();
        expect(mockFrom).toHaveBeenCalledWith('report_equipment_stats');
        expect(rows[0].partsCost).toBe(45.5);
    });

    it('getPartRotation lee de report_part_rotation', async () => {
        const c = chain([{ item_id: 'i1', item_name: 'Rodamiento', sku: 'R-1', total_used: 6, work_orders_count: 3 }]);
        mockFrom.mockReturnValueOnce(c);
        const rows = await reportService.getPartRotation();
        expect(mockFrom).toHaveBeenCalledWith('report_part_rotation');
        expect(rows[0].totalUsed).toBe(6);
    });

    it('getIncidentStats lee de report_incident_stats', async () => {
        const c = chain(null, {
            total: 10, open_count: 2, in_review_count: 1, resolved_count: 6,
            cancelled_count: 1, converted_count: 3, reasons_filled: 8,
            solutions_filled: 5, resolution_rate: 60, avg_resolution_days: 2.5
        });
        mockFrom.mockReturnValueOnce(c);
        const row = await reportService.getIncidentStats();
        expect(mockFrom).toHaveBeenCalledWith('report_incident_stats');
        expect(row?.resolutionRate).toBe(60);
    });
});
