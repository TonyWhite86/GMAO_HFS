import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { PreventivePlan } from '../../types';
import { preventivePlanService } from '../../services/preventivePlanService';
import { workOrderService } from '../../services/workOrderService';
import { PlanTargetsInput } from '../../utils/preventiveTargets';
import { toast } from 'sonner';

export interface PreventivePlanSlice {
    preventivePlans: PreventivePlan[];
    setPreventivePlans: (plans: PreventivePlan[]) => void;
    addPreventivePlan: (plan: PreventivePlan, targets?: PlanTargetsInput, launchFirst?: boolean) => Promise<void>;
    updatePreventivePlan: (plan: PreventivePlan, targets?: PlanTargetsInput) => Promise<void>;
    deletePreventivePlan: (id: string) => Promise<void>;
    generateWorkOrderFromPlan: (planId: string) => Promise<void>;
    updatePlanTarget: (targetId: string, nextRun: string) => Promise<void>;
}

export const createPreventivePlanSlice: StateCreator<AppState, [], [], PreventivePlanSlice> = (set, get) => ({
    preventivePlans: [],
    setPreventivePlans: (preventivePlans) => set({ preventivePlans }),

    addPreventivePlan: async (plan, targets, launchFirst) => {
        try {
            const newPlan = await preventivePlanService.create(plan, targets);
            toast.success('Plan preventivo creado');
            // Refrescar para traer los objetivos materializados
            const plans = await preventivePlanService.getAll();
            set({ preventivePlans: plans });
            if (launchFirst) {
                await get().generateWorkOrderFromPlan(newPlan.id);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al crear plan preventivo');
            throw error;
        }
    },

    updatePreventivePlan: async (plan, targets) => {
        try {
            await preventivePlanService.update(plan, targets);
            toast.success('Plan preventivo actualizado');
            const plans = await preventivePlanService.getAll();
            set({ preventivePlans: plans });
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar plan');
            throw error;
        }
    },

    deletePreventivePlan: async (id) => {
        try {
            await preventivePlanService.delete(id);
            toast.success('Plan eliminado');
            set((state) => ({
                preventivePlans: state.preventivePlans.filter((p) => p.id !== id)
            }));
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar plan');
            throw error;
        }
    },

    generateWorkOrderFromPlan: async (planId) => {
        try {
            // Motor en BD: una OT por objetivo (título «Plan — Equipo») y rueda
            // el ciclo de cada uno.
            await preventivePlanService.launchPlan(planId);
            toast.success('Órdenes preventivas lanzadas');
            const [plans, workOrders] = await Promise.all([
                preventivePlanService.getAll(),
                workOrderService.getAll()
            ]);
            set({ preventivePlans: plans, workOrders });
        } catch (error) {
            console.error(error);
            toast.error('Error al lanzar el plan');
            throw error;
        }
    },

    updatePlanTarget: async (targetId, nextRun) => {
        try {
            await preventivePlanService.updateTarget(targetId, nextRun);
            const plans = await preventivePlanService.getAll();
            set({ preventivePlans: plans });
            toast.success('Ciclo del objetivo actualizado');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar el ciclo');
            throw error;
        }
    }
});
