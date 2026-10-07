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
    transitionWorkOrder: (id: string, action: 'start' | 'pause' | 'resume' | 'complete', note?: string | null, manualMinutes?: number | null) => Promise<void>;
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
            const oldWO = get().workOrders.find((w) => w.id === wo.id);
            // Solo METADATOS: workOrderService.update no manda `status`, ni
            // `status_history`, ni `time_spent_minutes`, ni `closed_at`. Esos
            // campos los poseen transition_work_order / assign_work_order.
            await workOrderService.update(wo);

            // Conservamos del store los campos que manda la BD: si los tomáramos
            // del objeto del cliente, un guardado de metadatos podría pintar un
            // estado/tiempo que la BD no tiene.
            set((state: AppState) => ({
                workOrders: state.workOrders.map((w) => w.id === wo.id ? {
                    ...w,
                    ...wo,
                    status: w.status,
                    statusHistory: w.statusHistory,
                    timeSpentMinutes: w.timeSpentMinutes,
                    timeSource: w.timeSource,
                    timeRecordedBy: w.timeRecordedBy,
                    timeRecordedAt: w.timeRecordedAt,
                    closedAt: w.closedAt
                } : w)
            }));

            // Comentario de sistema en la incidencia relacionada SOLO por cambio
            // de asignación (el de cambio de estado lo escribe transition_work_order).
            if (oldWO?.relatedIncidentId && oldWO.assignedUserId !== wo.assignedUserId) {
                const currentUser = get().currentUser;
                const newAssignee = get().users.find((u) => u.id === wo.assignedUserId);
                await get().addIncidentComment({
                    incidentId: oldWO.relatedIncidentId,
                    userId: currentUser?.id,
                    userName: 'Sistema',
                    text: `Evolución OT: Asignada a ${newAssignee?.name || 'sin asignar'}`,
                    isSystem: true
                });
            }

            toast.success('Orden de trabajo actualizada');
        } catch (error) {
            toast.error('Error al actualizar orden');
            throw error;
        }
    },
    transitionWorkOrder: async (id, action, note, manualMinutes) => {
        try {
            const oldWO = get().workOrders.find((w) => w.id === id);
            // RPC atómica: append a status_history, time_spent_minutes derivado
            // del historial, closed_at y comentario de sistema. La BD es la
            // única dueña de esos campos. Si la OT pertenece a un plan
            // preventivo y se completa, la propia RPC lanza la siguiente
            // (launch_plan_next_wo) — no hay que volver a hacerlo aquí.
            await workOrderService.transition(id, action, note ?? null, manualMinutes ?? null);

            const now = new Date().toISOString();
            const histStatus = action === 'pause' ? WOStatus.PENDING
                : action === 'complete' ? WOStatus.COMPLETED
                : WOStatus.IN_PROGRESS;
            const newStatus = action === 'complete' ? WOStatus.COMPLETED : WOStatus.IN_PROGRESS;

            // Actualización optimista del store. El tiempo se refleja YA: si
            // esperamos al realtime, el usuario ve 0 hasta que llegue el evento.
            set((state) => ({
                workOrders: state.workOrders.map(w => {
                    if (w.id !== id) return w;
                    return {
                        ...w,
                        status: newStatus,
                        statusHistory: [...(w.statusHistory || []), { status: histStatus, timestamp: now }],
                        closedAt: action === 'complete' ? now : w.closedAt,
                        timeSpentMinutes: action === 'complete'
                            ? (manualMinutes != null && manualMinutes > 0 ? manualMinutes : w.timeSpentMinutes)
                            : w.timeSpentMinutes,
                        timeSource: action === 'complete'
                            ? (manualMinutes != null && manualMinutes > 0 ? 'manual' : 'sesion')
                            : w.timeSource
                    };
                })
            }));

            if (oldWO?.relatedIncidentId && oldWO.status !== newStatus) {
                await get().addIncidentComment({
                    incidentId: oldWO.relatedIncidentId,
                    userId: get().currentUser?.id,
                    userName: 'Sistema',
                    text: `Evolución OT: El estado ha cambiado de "${oldWO.status}" a "${newStatus}"`,
                    isSystem: true
                });
            }

            if (action === 'complete') {
                toast.success('Orden de trabajo finalizada');
            }
        } catch (error) {
            toast.error('Error al actualizar el estado de la orden');
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
