import { StateCreator } from 'zustand';
import { Equipment } from '../../types';
import { equipmentService } from '../../services/equipmentService';
import { toast } from 'sonner';

export interface EquipmentSlice {
    equipment: Equipment[];
    setEquipment: (equipment: Equipment[]) => void;
    addEquipment: (eq: Equipment) => Promise<void>;
    updateEquipment: (eq: Equipment) => Promise<void>;
}

export const createEquipmentSlice: StateCreator<EquipmentSlice, [], [], EquipmentSlice> = (set, get) => ({
    equipment: [],
    setEquipment: (equipment) => set({ equipment }),
    addEquipment: async (eq) => {
        try {
            const newEq = await equipmentService.create(eq);
            toast.success('Equipo añadido con éxito');
            set((state) => {
                if (state.equipment.find(e => e.id === newEq.id)) return state;
                return { equipment: [newEq, ...state.equipment] };
            });
        } catch (error: any) {
            console.error('Error creating equipment:', error);
            toast.error(`Error al crear equipo: ${error.message || 'Error desconocido'}`);
            throw error;
        }
    },
    updateEquipment: async (updatedEq) => {
        try {
            const currentEq = get().equipment.find(e => e.id === updatedEq.id);
            await equipmentService.update(updatedEq, currentEq);
            toast.success('Equipo actualizado');
            set((state) => ({
                equipment: state.equipment.map(e => e.id === updatedEq.id ? updatedEq : e)
            }));
        } catch (error) {
            toast.error('Error al actualizar equipo');
            throw error;
        }
    }
});
