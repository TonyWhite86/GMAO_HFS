import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { EquipmentGroup } from '../../types';
import { equipmentGroupService } from '../../services/equipmentGroupService';
import { toast } from 'sonner';

export interface EquipmentGroupSlice {
    equipmentGroups: EquipmentGroup[];
    setEquipmentGroups: (groups: EquipmentGroup[]) => void;
    addEquipmentGroup: (group: Partial<EquipmentGroup>) => Promise<EquipmentGroup>;
    updateEquipmentGroup: (id: string, updates: Partial<EquipmentGroup>) => Promise<void>;
    deleteEquipmentGroup: (id: string) => Promise<void>;
}

export const createEquipmentGroupSlice: StateCreator<AppState, [], [], EquipmentGroupSlice> = (set) => ({
    equipmentGroups: [],
    setEquipmentGroups: (equipmentGroups) => set({ equipmentGroups }),

    addEquipmentGroup: async (groupData) => {
        try {
            const created = await equipmentGroupService.create(groupData);
            toast.success('Grupo de equipos creado');
            set((state) => ({
                equipmentGroups: [...state.equipmentGroups, created]
            }));
            return created;
        } catch (error) {
            toast.error('Error al crear el grupo');
            throw error;
        }
    },

    updateEquipmentGroup: async (id, updates) => {
        try {
            const updated = await equipmentGroupService.update(id, updates);
            set((state) => ({
                equipmentGroups: state.equipmentGroups.map(g => g.id === id ? updated : g)
            }));
            toast.success('Grupo actualizado');
        } catch (error) {
            toast.error('Error al actualizar el grupo');
            throw error;
        }
    },

    deleteEquipmentGroup: async (id) => {
        try {
            await equipmentGroupService.delete(id);
            set((state) => ({
                equipmentGroups: state.equipmentGroups.filter(g => g.id !== id)
            }));
            toast.success('Grupo eliminado');
        } catch (error) {
            toast.error('Error al eliminar el grupo');
            throw error;
        }
    }
});
