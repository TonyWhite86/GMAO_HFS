import { StateCreator } from 'zustand';
import { Section } from '../../types';
import { sectionService } from '../../services/sectionService';
import { toast } from 'sonner';

export interface SectionSlice {
    sections: Section[];
    setSections: (sections: Section[]) => void;
    addSection: (section: Partial<Section>) => Promise<void>;
    updateSection: (section: Section) => Promise<void>;
    deleteSection: (id: string) => Promise<void>;
}

export const createSectionSlice: StateCreator<SectionSlice, [], [], SectionSlice> = (set) => ({
    sections: [],
    setSections: (sections) => set({ sections }),
    addSection: async (sectionData) => {
        try {
            const newSection = await sectionService.create(sectionData);
            toast.success('Sección añadida correctamente');
            set((state) => {
                if (state.sections.find(s => s.id === newSection.id)) return state;
                return { sections: [...state.sections, newSection] };
            });
        } catch (error) {
            toast.error('Error al añadir sección');
            throw error;
        }
    },
    updateSection: async (section) => {
        try {
            await sectionService.update(section);
            toast.success('Sección actualizada correctamente');
            set((state) => ({
                sections: state.sections.map(s => s.id === section.id ? section : s)
            }));
        } catch (error) {
            toast.error('Error al actualizar sección');
            throw error;
        }
    },
    deleteSection: async (id) => {
        try {
            await sectionService.delete(id);
            toast.success('Sección eliminada');
            set((state) => ({
                sections: state.sections.filter(s => s.id !== id)
            }));
        } catch (error) {
            toast.error('Error al eliminar sección');
            throw error;
        }
    }
});
