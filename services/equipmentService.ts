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

        // Sync de documentos (tabla attachments). Reemplazo completo: la lista
        // de documentos del equipo se guarda tal cual, incluyendo carpetas
        // (url vacía) y la categoría de documentación.
        const docs = updatedEq.documents || [];
        const { data: existingAtts } = await supabase
            .from('attachments')
            .select('*')
            .eq('parent_id', updatedEq.id)
            .eq('parent_type', 'equipment');

        const existingById = new Map((existingAtts || []).map((a: any) => [a.id, a]));
        const toInsert = docs
            .filter(d => !existingById.has(d.id))
            .map(d => ({
                id: d.id,
                parent_id: updatedEq.id,
                parent_type: 'equipment',
                name: d.name,
                url: d.url || '',
                type: d.type,
                category: d.category ?? null
            }));
        if (toInsert.length > 0) {
            await supabase.from('attachments').insert(toInsert);
        }

        const keepIds = new Set(docs.map(d => d.id));
        const toDelete = (existingAtts || []).filter((a: any) => !keepIds.has(a.id));
        for (const att of toDelete) {
            await supabase.from('attachments').delete().eq('id', att.id);
        }

        // Cambios de categoría/nombre en documentos ya existentes
        for (const d of docs) {
            const prev = existingById.get(d.id) as any;
            if (!prev) continue;
            const nextCat = d.category ?? null;
            if (prev.category !== nextCat || prev.name !== d.name) {
                await supabase.from('attachments')
                    .update({ category: nextCat, name: d.name })
                    .eq('id', d.id);
            }
        }

        return mapEquipment(data, docs.map(d => ({
            id: d.id,
            parent_id: updatedEq.id,
            parent_type: 'equipment',
            name: d.name,
            url: d.url,
            type: d.type,
            category: d.category ?? null,
            created_at: d.date
        })));
    },

    delete: async (id: string) => {
        const { error } = await supabase.from('equipment').delete().eq('id', id);
        if (error) throw error;
        return id;
    }
};
