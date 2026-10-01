import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { PreventivePlan, WOStatus, WOPriority, WOType } from '../../types';
import { preventivePlanService } from '../../services/preventivePlanService';
import { workOrderService } from '../../services/workOrderService';
import { toast } from 'sonner';

export interface PreventivePlanSlice {
    preventivePlans: PreventivePlan[];
    setPreventivePlans: (plans: PreventivePlan[]) => void;
    addPreventivePlan: (plan: PreventivePlan, launchFirst?: boolean) => Promise<void>;
    updatePreventivePlan: (plan: PreventivePlan) => Promise<void>;
    deletePreventivePlan: (id: string) => Promise<void>;
    generateWorkOrderFromPlan: (planId: string, customDate?: string) => Promise<void>;
}

export const createPreventivePlanSlice: StateCreator<AppState, [], [], PreventivePlanSlice> = (set, get) => ({
    preventivePlans: [],
    setPreventivePlans: (plans) => set({ preventivePlans: plans }),
    addPreventivePlan: async (plan, launchFirst) => {
        try {
            const newPlan = await preventivePlanService.create(plan);
            toast.success('Plan preventivo creado');
            set((state) => {
                if (state.preventivePlans.find((p) => p.id === newPlan.id)) return state;
                return { preventivePlans: [...state.preventivePlans, newPlan] };
            });

            if (launchFirst) {
                await get().generateWorkOrderFromPlan(newPlan.id, new Date().toISOString());
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al crear plan preventivo');
            throw error;
        }
    },
    updatePreventivePlan: async (plan) => {
        try {
            await preventivePlanService.update(plan);
            toast.success('Plan preventivo actualizado');
            set((state) => ({
                preventivePlans: state.preventivePlans.map((p) => p.id === plan.id ? plan : p)
            }));
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
    generateWorkOrderFromPlan: async (planId, customDate) => {
        const state = get();
        const plan = state.preventivePlans.find((p) => p.id === planId);
        if (!plan) return;

        const eq = state.equipment.find((e) => e.id === plan.equipmentId);
        const section = plan.section || eq?.sections?.[0] || 'Producción';
        const scheduledDate = customDate || plan.nextRun || new Date().toISOString();

        const nextWO = {
            id: '',
            title: plan.name,
            description: plan.description || `Mantenimiento Preventivo: ${plan.name}`,
            type: WOType.PREVENTIVE,
            status: WOStatus.SCHEDULED,
            priority: WOPriority.MEDIUM,
            equipmentId: plan.equipmentId,
            assignedUserId: null,
            createdBy: state.currentUser?.id || null,
            createdAt: new Date().toISOString(),
            scheduledDate: scheduledDate,
            section: section,
            relatedPlanId: plan.id,
            statusHistory: [{ status: WOStatus.SCHEDULED, timestamp: new Date().toISOString() }],
            usedParts: [],
            attachments: [],
            comments: [],
            subtasks: plan.tasks?.map((t) => ({
                id: crypto.randomUUID(),
                description: t.description,
                completed: false,
                assignedUserIds: t.assignedUserIds || []
            })) || []
        };

        try {
            const nextRun = new Date(scheduledDate);
            nextRun.setUTCDate(nextRun.getUTCDate() + plan.frequencyDays);
            const nextRunIso = nextRun.toISOString();
            const lastRunIso = new Date().toISOString();

            await preventivePlanService.updateDates(plan.id, lastRunIso, nextRunIso);

            const newWO = await workOrderService.create(nextWO);
            toast.success(`Orden preventiva lanzada para el ${new Date(scheduledDate).toLocaleDateString()}`);

            set((state) => ({
                workOrders: state.workOrders.find((w) => w.id === newWO.id)
                    ? state.workOrders
                    : [newWO, ...state.workOrders],
                preventivePlans: state.preventivePlans.map((p) =>
                    p.id === plan.id ? { ...p, lastRun: lastRunIso, nextRun: nextRunIso } : p
                )
            }));

        } catch (error) {
            console.error(error);
            toast.error('Error al lanzar orden preventiva');
            throw error;
        }
    }
});
