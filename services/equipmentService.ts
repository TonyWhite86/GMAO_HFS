import { supabase } from '../lib/supabase';
import { Equipment, PaginationParams } from '../types';
import { mapEquipment } from '../utils/mappers';

export const equipmentService = {
    getAll: async (pagination?: PaginationParams) => {
        let eqQuery = supabase.from('equipment').select('*');
        if (pagination) {
            const from = (pagination.page - 1) * pagination.pageSize;
            eqQuery = eqQuery.range(from, from + pagination.pageSize - 1);
        }
        const [
            { data: equipment, error: eqError },
            { data: allAttachments, error: attError }
        ] = await Promise.all([
            eqQuery,
            supabase.from('attachments').select('*').eq('parent_type', 'equipment')
        ]);

        if (eqError) throw eqError;
        if (attError) throw attError;

        return (equipment || []).map(e => mapEquipment(e, allAttachments || []));
    },

    create: async (eq: Equipment) => {
        const { data, error } = await supabase.from('equipment').insert([{
            name: eq.name,
            manufacturer: eq.manufacturer,
            serial_number: eq.serialNumber,
            location: eq.location,
            status: eq.status,
            sections: eq.sections,
            parent_id: eq.parentId,
            photo_url: eq.photoUrl,
            qr_code: eq.qrCode,
            code: eq.code || undefined
        }]).select().single();

        if (error) throw error;
        return mapEquipment(data);
    },

    update: async (updatedEq: Equipment, currentEq?: Equipment) => {
        if (currentEq?.photoUrl && currentEq.photoUrl !== updatedEq.photoUrl) {
            try {
                const oldUrl = currentEq.photoUrl;
                const fileName = oldUrl.split('/').pop();

                if (oldUrl.includes('equipment-photos') && fileName) {
                    await supabase.storage
                        .from('equipment-photos')
                        .remove([fileName]);
                }
            } catch (err) {
                console.error('Error processing photo cleanup:', err);
            }
        }

        const { data, error } = await supabase
            .from('equipment')
            .update({
                name: updatedEq.name,
                manufacturer: updatedEq.manufacturer,
                serial_number: updatedEq.serialNumber,
                location: updatedEq.location,
                status: updatedEq.status,
                sections: updatedEq.sections,
                parent_id: updatedEq.parentId,
                photo_url: updatedEq.photoUrl,
                qr_code: updatedEq.qrCode,
                code: updatedEq.code
            })
            .eq('id', updatedEq.id)
            .select()
            .single();

        if (error) throw error;
        return mapEquipment(data);
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('equipment').delete().eq('id', id);
        if (error) throw error;
        return id;
    }
};
