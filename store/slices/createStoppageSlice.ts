import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { EquipmentStoppage } from '../../types';
import { stoppageService } from '../../services/stoppageService';
import { toast } from 'sonner';

export interface StoppageSlice {
    stoppages: EquipmentStoppage[];
    setStoppages: (stoppages: EquipmentStoppage[]) => void;
    addStoppage: (stoppage: Partial<EquipmentStoppage>) => Promise<EquipmentStoppage>;
    addStoppageBatch: (stoppages: Partial<EquipmentStoppage>[]) => Promise<EquipmentStoppage[]>;
    updateStoppage: (id: string, updates: Partial<EquipmentStoppage>) => Promise<void>;
    deleteStoppage: (id: string) => Promise<void>;
}

export const createStoppageSlice: StateCreator<AppState, [], [], StoppageSlice> = (set) => ({
    stoppages: [],
    setStoppages: (stoppages) => set({ stoppages }),

    addStoppage: async (stoppageData) => {
        try {
            const created = await stoppageService.create(stoppageData);
            toast.success('Parada programada creada');
            set((state) => {
                if (state.stoppages.find(s => s.id === created.id)) return state;
                return { stoppages: [...state.stoppages, created] };
            });
            return created;
        } catch (error) {
            toast.error('Error al crear la parada');
            throw error;
        }
    },

    addStoppageBatch: async (stoppagesData) => {
        try {
            const created = await stoppageService.createBatch(stoppagesData);
            toast.success(created.length === 1
                ? 'Parada programada creada'
                : `${created.length} paradas programadas creadas`);
            set((state) => {
                const known = new Set(state.stoppages.map(s => s.id));
                return { stoppages: [...state.stoppages, ...created.filter(c => !known.has(c.id))] };
            });
            return created;
        } catch (error) {
            toast.error('Error al crear las paradas');
            throw error;
        }
    },

    updateStoppage: async (id, updates) => {
        try {
            const updated = await stoppageService.update(id, updates);
            toast.success('Parada actualizada');
            set((state) => ({
                stoppages: state.stoppages.map(s => s.id === id ? updated : s)
            }));
        } catch (error) {
            toast.error('Error al actualizar la parada');
            throw error;
        }
    },

    deleteStoppage: async (id) => {
        try {
            await stoppageService.delete(id);
            toast.success('Parada eliminada');
            set((state) => ({
                stoppages: state.stoppages.filter(s => s.id !== id)
            }));
        } catch (error) {
            toast.error('Error al eliminar la parada');
            throw error;
        }
    }
});
