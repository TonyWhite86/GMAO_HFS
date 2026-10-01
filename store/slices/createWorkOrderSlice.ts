import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { WorkOrder, Comment, WOStatus } from '../../types';
import { workOrderService } from '../../services/workOrderService';
import { toast } from 'sonner';

export interface WorkOrderSlice {
    workOrders: WorkOrder[];
    setWorkOrders: (workOrders: WorkOrder[]) => void;
    addWorkOrder: (wo: WorkOrder) => Promise<WorkOrder>;
    updateWorkOrder: (wo: WorkOrder) => Promise<void>;
    addComment: (comment: Comment, workOrderId: string) => Promise<void>;
    toggleSubtask: (subtaskId: string, completed: boolean) => Promise<void>;
}

export const createWorkOrderSlice: StateCreator<AppState, [], [], WorkOrderSlice> = (set, get) => ({
    workOrders: [],
    setWorkOrders: (workOrders) => set({ workOrders }),
    addWorkOrder: async (wo) => {
        try {
            const woWithDefaults = {
                ...wo,
                scheduledDate: wo.scheduledDate || new Date().toISOString(),
            };
            const newWO = await workOrderService.create(woWithDefaults);
            toast.success('Orden de trabajo creada');
            set((state) => {
                if (state.workOrders.find((w) => w.id === newWO.id)) {
                    return state;
                }
                return { workOrders: [newWO, ...state.workOrders] };
            });
            return newWO;
        } catch (error) {
            toast.error('Error al crear orden');
            throw error;
        }
    },
    updateWorkOrder: async (wo) => {
        try {
            let updatedWO = { ...wo };

            if (updatedWO.status === WOStatus.PENDING || updatedWO.status === WOStatus.SCHEDULED) {
                if (updatedWO.assignedUserId) {
                    updatedWO.status = WOStatus.SCHEDULED;
                } else {
                    updatedWO.status = WOStatus.PENDING;
                    updatedWO.scheduledDate = undefined;
                }
            }

            const oldWO = get().workOrders.find((w) => w.id === updatedWO.id);
            await workOrderService.update(updatedWO);

            if (oldWO?.relatedIncidentId) {
                const currentUser = get().currentUser;
                const incidentId = oldWO.relatedIncidentId;

                if (oldWO.status !== updatedWO.status) {
                    await get().addIncidentComment({
                        incidentId,
                        userId: currentUser?.id,
                        userName: 'Sistema',
                        text: `Evolución OT: El estado ha cambiado de "${oldWO.status}" a "${updatedWO.status}"`,
                        isSystem: true
                    });
                }

                if (oldWO.assignedUserId !== updatedWO.assignedUserId) {
                    const newAssignee = get().users.find((u) => u.id === updatedWO.assignedUserId);
                    await get().addIncidentComment({
                        incidentId,
                        userId: currentUser?.id,
                        userName: 'Sistema',
                        text: `Evolución OT: Asignada a ${newAssignee?.name || 'sin asignar'}`,
                        isSystem: true
                    });
                }
            }

            const wasCompleted = oldWO?.status !== WOStatus.COMPLETED && updatedWO.status === WOStatus.COMPLETED;
            toast.success(wasCompleted ? 'Orden de trabajo finalizada' : 'Orden de trabajo actualizada');
            set((state: AppState) => ({
                workOrders: state.workOrders.map((w) => w.id === updatedWO.id ? updatedWO : w)
            }));

            if (oldWO && oldWO.status !== WOStatus.COMPLETED && updatedWO.status === WOStatus.COMPLETED && updatedWO.relatedPlanId) {
                const plan = get().preventivePlans.find((p) => p.id === updatedWO.relatedPlanId);
                if (plan) {
                    await get().generateWorkOrderFromPlan(plan.id, plan.nextRun);
                }
            }
        } catch (error) {
            toast.error('Error al actualizar orden');
            throw error;
        }
    },
    addComment: async (comment, workOrderId) => {
        try {
            const newComment = await workOrderService.addComment(comment, workOrderId);
            set((state) => ({
                workOrders: state.workOrders.map(wo => {
                    if (wo.id === workOrderId) {
                        const exists = wo.comments?.some(c => c.id === newComment.id);
                        if (exists) return wo;
                        return { ...wo, comments: [...(wo.comments || []), newComment] };
                    }
                    return wo;
                })
            }));
        } catch (error) {
            toast.error('Error al añadir comentario');
            throw error;
        }
    },
    toggleSubtask: async (subtaskId, completed) => {
        try {
            await workOrderService.toggleSubtask(subtaskId, completed);
            if (completed) {
                toast.success('Subtarea completada');
            }
            set((state) => ({
                workOrders: state.workOrders.map(wo => ({
                    ...wo,
                    subtasks: wo.subtasks?.map(st =>
                        st.id === subtaskId ? { ...st, completed } : st
                    )
                }))
            }));
        } catch (error) {
            toast.error('Error al actualizar subtarea');
            throw error;
        }
    }
});
