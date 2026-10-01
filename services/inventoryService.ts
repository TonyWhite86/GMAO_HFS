import { supabase } from '../lib/supabase';
import { InventoryItem, PaginationParams } from '../types';
import { mapInventoryItem, mapInventoryMovement } from '../utils/mappers';

export const inventoryService = {
    getAll: async (pagination?: PaginationParams) => {
        let query = supabase
            .from('inventory')
            .select('*')
            .order('created_at', { ascending: false });
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            query = query.range(from, from + pagination.pageSize - 1);
        }
        const { data, error } = await query;

        if (error) throw error;
        return (data || []).map(mapInventoryItem);
    },

    getById: async (id: string) => {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return mapInventoryItem(data);
    },

    create: async (item: InventoryItem) => {
        const { data, error } = await supabase.from('inventory').insert([{
            name: item.name,
            sku: item.sku,
            manufacturer: item.manufacturer,
            quantity: item.quantity,
            min_stock: item.minStock,
            category: item.category,
            location: item.location,
            price: item.price,
            supplier: item.supplier,
            qr_code: item.qrCode,
            critic: item.critic,
            status: item.status || 'Active',
            image: item.image,
            linked_equipment_ids: item.linkedEquipmentIds
        }]).select().single();

        if (error) throw error;
        return mapInventoryItem(data);
    },

    update: async (item: InventoryItem) => {
        const { data, error } = await supabase
            .from('inventory')
            .update({
                name: item.name,
                sku: item.sku,
                manufacturer: item.manufacturer,
                quantity: item.quantity,
                min_stock: item.minStock,
                category: item.category,
                location: item.location,
                price: item.price,
                supplier: item.supplier,
                qr_code: item.qrCode,
                critic: item.critic,
                status: item.status,
                image: item.image,
                linked_equipment_ids: item.linkedEquipmentIds
            })
            .eq('id', item.id)
            .select()
            .single();
        if (error) throw error;
        return mapInventoryItem(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
        return id;
    },

    getMovements: async (filters?: { itemId?: string; type?: 'IN' | 'OUT'; startDate?: string; endDate?: string }) => {
        let query = supabase
            .from('inventory_movements')
            .select('*, user:user_id(name), item:item_id(name, sku)')
            .order('created_at', { ascending: false });

        if (filters?.itemId) query = query.eq('item_id', filters.itemId);
        if (filters?.type) query = query.eq('type', filters.type);
        if (filters?.startDate) query = query.gte('created_at', filters.startDate);
        if (filters?.endDate) query = query.lte('created_at', filters.endDate);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(mapInventoryMovement);
    },

    registerMovement: async (movement: { itemId: string; type: 'IN' | 'OUT'; quantity: number; reason?: string; userId: string }) => {
        const { error } = await supabase.rpc('register_inventory_movement', {
            p_item_id: movement.itemId,
            p_type: movement.type,
            p_quantity: movement.quantity,
            p_reason: movement.reason || null,
            p_user_id: movement.userId || null
        });
        if (error) throw error;
    },

    mergeItems: async (keepId: string, deleteId: string) => {
        const { error } = await supabase.rpc('merge_inventory_items', {
            keep_id: keepId,
            delete_id: deleteId
        });
        if (error) throw error;
        return keepId;
    }
};
