import { supabase } from '../lib/supabase';
import { EquipmentAcceptance } from '../types';
import { mapEquipmentAcceptance } from '../utils/mappers';

export const equipmentAcceptanceService = {
    getAll: async (): Promise<EquipmentAcceptance[]> => {
        const { data, error } = await supabase
            .from('equipment_acceptance')
            .select('*');
        if (error) throw error;
        return (data || []).map(mapEquipmentAcceptance);
    },

    /** Upsert completo de la aceptación de un equipo. */
    save: async (acceptance: EquipmentAcceptance): Promise<EquipmentAcceptance> => {
        const row = {
            equipment_id: acceptance.equipmentId,
            manuals_ok: acceptance.manualsOk,
            conformity_ok: acceptance.conformityOk,
            signoffs: (acceptance.signoffs || []).map(x => ({
                id: x.id,
                department: x.department,
                user_id: x.userId ?? null,
                user_name: x.userName ?? null,
                date: x.date
            })),
            trainings: (acceptance.trainings || []).map(x => ({
                id: x.id,
                trainee: x.trainee,
                trainee_id: x.traineeId ?? null,
                trainer: x.trainer,
                trainer_id: x.trainerId ?? null,
                date: x.date
            }))
        };
        const { data, error } = await supabase
            .from('equipment_acceptance')
            .upsert([row], { onConflict: 'equipment_id' })
            .select()
            .single();
        if (error) throw error;
        return mapEquipmentAcceptance(data);
    }
};
