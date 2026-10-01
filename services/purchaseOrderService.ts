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
        const { data: newOrder, error: orderError } = await supabase
            .from('purchase_orders')
            .insert({
                number: order.number,
                supplier: order.supplier,
                status: order.status,
                requested_by: order.requestedBy,
                requested_date: order.requestedDate,
                notes: order.notes,
                total_amount: order.totalAmount
            })
            .select()
            .single();

        if (orderError) throw orderError;

        const itemsToInsert = items.map(item => ({
            order_id: newOrder.id,
            part_id: item.partId,
            quantity: item.quantity,
            unit_price: item.unitPrice || 0,
            equipment_id: item.equipmentId
        }));

        const { data: newItems, error: itemsError } = await supabase
            .from('purchase_order_items')
            .insert(itemsToInsert)
            .select();

        if (itemsError) throw itemsError;

        return mapPurchaseOrder({ ...newOrder, items: newItems });
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
    }
};
