import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { Contractor } from '../../types';
import { contractorService } from '../../services/contractorService';
import { toast } from 'sonner';

export interface ContractorSlice {
    contractors: Contractor[];
    setContractors: (contractors: Contractor[]) => void;
    addContractor: (contractor: Partial<Contractor>) => Promise<Contractor>;
    updateContractor: (id: string, updates: Partial<Contractor>) => Promise<void>;
    deleteContractor: (id: string) => Promise<void>;
}

export const createContractorSlice: StateCreator<AppState, [], [], ContractorSlice> = (set) => ({
    contractors: [],
    setContractors: (contractors) => set({ contractors }),

    addContractor: async (contractorData) => {
        try {
            const created = await contractorService.create(contractorData);
            toast.success('Contrata creada');
            set((state) => ({
                contractors: [...state.contractors, created]
            }));
            return created;
        } catch (error) {
            toast.error('Error al crear la contrata');
            throw error;
        }
    },

    updateContractor: async (id, updates) => {
        try {
            const updated = await contractorService.update(id, updates);
            set((state) => ({
                contractors: state.contractors.map(c => c.id === id ? updated : c)
            }));
            toast.success('Contrata actualizada');
        } catch (error) {
            toast.error('Error al actualizar la contrata');
            throw error;
        }
    },

    deleteContractor: async (id) => {
        try {
            await contractorService.delete(id);
            set((state) => ({
                contractors: state.contractors.filter(c => c.id !== id)
            }));
            toast.success('Contrata eliminada');
        } catch (error) {
            toast.error('Error al eliminar la contrata');
            throw error;
        }
    }
});
