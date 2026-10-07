import { supabase } from '../lib/supabase';
import { PurchaseOrder, PaginationParams } from '../types';
import { mapPurchaseOrder } from '../utils/mappers';

export const purchaseOrderService = {
    async getAll(pagination?: PaginationParams) {
        let query = supabase
            .from('purchase_orders')
            .select('*, items:purchase_order_items(*)')
            .order('created_at', { ascending: false });
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data: orders, error: ordersError } = await query;

        if (ordersError) throw ordersError;
        return (orders || []).map(mapPurchaseOrder);
    },

    async create(order: Partial<PurchaseOrder>, items: any[]) {
        // RPC atómica: número por secuencia (REQ-YYYY-######) y total calculado
        // en BD. Un único INSERT transaccional en vez de order + N items.
        const id = await purchaseOrderService.createAtomic({
            notes: order.notes ?? null,
            status: (order.status as string) ?? 'Solicitado',
            expectedDate: order.expectedDate ?? null,
            items: (items || []).map((i: any) => ({
                partId: i.partId,
                quantity: i.quantity,
                unitPrice: i.unitPrice || 0,
                equipmentId: i.equipmentId || null
            }))
        });

        const { data: newOrder, error } = await supabase
            .from('purchase_orders')
            .select('*, items:purchase_order_items(*)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return mapPurchaseOrder(newOrder);
    },

    async update(order: PurchaseOrder) {
        const { data, error } = await supabase
            .from('purchase_orders')
            .update({
                supplier: order.supplier,
                status: order.status,
                order_date: order.orderDate,
                expected_date: order.expectedDate,
                received_date: order.receivedDate,
                notes: order.notes,
                total_amount: order.totalAmount
            })
            .eq('id', order.id)
            .select('*, items:purchase_order_items(*)')
            .single();

        if (error) throw error;
        return mapPurchaseOrder(data);
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('purchase_orders')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return id;
    },

    /** Creación atómica con número por secuencia y total calculado en BD. */
    createAtomic: async (payload: {
        notes?: string | null;
        status?: string;
        expectedDate?: string | null;
        items: { partId: string; quantity: number; unitPrice?: number; equipmentId?: string | null }[];
    }) => {
        const { data, error } = await supabase.rpc('create_purchase_order', {
            p_notes: payload.notes ?? null,
            p_status: payload.status ?? 'Solicitado',
            p_expected_date: payload.expectedDate ?? null,
            p_items: payload.items.map(i => ({
                part_id: i.partId,
                quantity: i.quantity,
                unit_price: i.unitPrice ?? 0,
                equipment_id: i.equipmentId ?? null
            }))
        });
        if (error) throw error;
        return data as string;
    },

    /** Recepción atómica: acumula cantidades, decide estado y descuenta stock. */
    receive: async (orderId: string, items: { itemId: string; quantity: number }[]) => {
        const { error } = await supabase.rpc('receive_purchase_order', {
            p_order_id: orderId,
            p_items: items.map(i => ({ item_id: i.itemId, quantity: i.quantity }))
        });
        if (error) throw error;
    }
};
