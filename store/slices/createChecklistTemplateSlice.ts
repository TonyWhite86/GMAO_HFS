import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { ChecklistTemplate } from '../../types';
import { checklistTemplateService } from '../../services/checklistTemplateService';
import { toast } from 'sonner';

export interface ChecklistTemplateSlice {
    checklistTemplates: ChecklistTemplate[];
    setChecklistTemplates: (templates: ChecklistTemplate[]) => void;
    addChecklistTemplate: (template: Partial<ChecklistTemplate>) => Promise<ChecklistTemplate>;
    updateChecklistTemplate: (id: string, updates: Partial<ChecklistTemplate>) => Promise<void>;
    deleteChecklistTemplate: (id: string) => Promise<void>;
}

export const createChecklistTemplateSlice: StateCreator<AppState, [], [], ChecklistTemplateSlice> = (set) => ({
    checklistTemplates: [],
    setChecklistTemplates: (checklistTemplates) => set({ checklistTemplates }),

    addChecklistTemplate: async (templateData) => {
        try {
            const created = await checklistTemplateService.create(templateData);
            toast.success('Plantilla de checklist guardada');
            set((state) => ({
                checklistTemplates: [...state.checklistTemplates, created]
            }));
            return created;
        } catch (error) {
            toast.error('Error al guardar la plantilla');
            throw error;
        }
    },

    updateChecklistTemplate: async (id, updates) => {
        try {
            const updated = await checklistTemplateService.update(id, updates);
            set((state) => ({
                checklistTemplates: state.checklistTemplates.map(t => t.id === id ? updated : t)
            }));
            toast.success('Plantilla actualizada');
        } catch (error) {
            toast.error('Error al actualizar la plantilla');
            throw error;
        }
    },

    deleteChecklistTemplate: async (id) => {
        try {
            await checklistTemplateService.delete(id);
            set((state) => ({
                checklistTemplates: state.checklistTemplates.filter(t => t.id !== id)
            }));
            toast.success('Plantilla eliminada');
        } catch (error) {
            toast.error('Error al eliminar la plantilla');
            throw error;
        }
    }
});
