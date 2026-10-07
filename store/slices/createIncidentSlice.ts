import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { Incident, IncidentComment, IncidentStatus, IncidentCategory } from '../../types';
import { incidentService } from '../../services/incidentService';
import { incidentCategoryService } from '../../services/incidentCategoryService';
import { stoppageService } from '../../services/stoppageService';
import { workOrderService } from '../../services/workOrderService';
import { toast } from 'sonner';

export interface IncidentSlice {
    incidents: Incident[];
    incidentCategories: IncidentCategory[];
    setIncidents: (incidents: Incident[]) => void;
    setIncidentCategories: (categories: IncidentCategory[]) => void;
    addIncidentCategory: (category: Partial<IncidentCategory>) => Promise<IncidentCategory>;
    updateIncidentCategory: (id: string, updates: Partial<IncidentCategory>) => Promise<void>;
    deleteIncidentCategory: (id: string) => Promise<void>;
    addIncident: (incident: Partial<Incident>) => Promise<void>;
    addIncidentWithStoppage: (payload: {
        title: string; description: string; priority: string; categoryId: string;
        section?: string | null; equipmentId: string; attachments?: unknown[];
        withStoppage?: boolean; stoppageTitle?: string | null;
        stoppageStartAt?: string | null;
        stoppageDescription?: string | null;
    }) => Promise<{ incidentId: string; stoppageId: string | null }>;
    updateIncident: (id: string, updates: Partial<Incident>) => Promise<void>;
    transitionIncidentStatus: (id: string, status: IncidentStatus, reason?: string, solution?: string) => Promise<void>;
    addIncidentComment: (comment: Partial<IncidentComment>) => Promise<void>;
    convertToWorkOrder: (incidentId: string, woData: any) => Promise<void>;
}

function isSupabaseConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as Record<string, unknown>;
    return e?.status === 409;
}

export const createIncidentSlice: StateCreator<AppState, [], [], IncidentSlice> = (set, get) => ({
    incidents: [],
    incidentCategories: [],
    setIncidents: (incidents) => set({ incidents }),
    setIncidentCategories: (incidentCategories) => set({ incidentCategories }),

    addIncidentCategory: async (categoryData) => {
        try {
            const created = await incidentCategoryService.create(categoryData);
            toast.success('Categoría creada');
            set((state) => ({
                incidentCategories: [...state.incidentCategories, created]
            }));
            return created;
        } catch (error) {
            toast.error('Error al crear categoría');
            throw error;
        }
    },

    updateIncidentCategory: async (id, updates) => {
        try {
            const updated = await incidentCategoryService.update(id, updates);
            toast.success('Categoría actualizada');
            set((state) => ({
                incidentCategories: state.incidentCategories.map(c => c.id === id ? updated : c)
            }));
        } catch (error) {
            toast.error('Error al actualizar categoría');
            throw error;
        }
    },

    deleteIncidentCategory: async (id) => {
        try {
            await incidentCategoryService.delete(id);
            toast.success('Categoría eliminada');
            set((state) => ({
                incidentCategories: state.incidentCategories.filter(c => c.id !== id)
            }));
        } catch (error) {
            toast.error('Error al eliminar categoría');
            throw error;
        }
    },

    addIncidentWithStoppage: async (payload) => {
        try {
            // RPC atómica: crea la incidencia y su parada en una sola
            // transacción. Si falla la parada no queda una incidencia sin ella.
            const result = await incidentService.createWithStoppage(payload);
            toast.success(payload.withStoppage
                ? 'Incidencia y parada registradas'
                : 'Incidencia reportada correctamente');

            // Refresco desde la BD para tener los ids reales y los joins
            const incidents = await incidentService.getAll();
            set({ incidents });
            if (result.stoppageId) {
                const stoppages = await stoppageService.getAll();
                set({ stoppages });
            }
            return result;
        } catch (error) {
            toast.error('Error al reportar la incidencia');
            throw error;
        }
    },
    addIncident: async (incidentData) => {
        try {
            const newIncident = await incidentService.create(incidentData);
            toast.success('Incidencia reportada correctamente');
            set((state) => {
                if (state.incidents.find((i: any) => i.id === newIncident.id)) return state;
                return {
                    incidents: [newIncident as any, ...state.incidents]
                };
            });
        } catch (error) {
            toast.error('Error al reportar incidencia');
            throw error;
        }
    },

    updateIncident: async (id, updates) => {
        try {
            const updated = await incidentService.update(id, updates);
            set((state) => ({
                incidents: state.incidents.map(inc => inc.id === id ? { ...inc, ...updated } : inc)
            }));
        } catch (error) {
            toast.error('Error al actualizar incidencia');
            throw error;
        }
    },

    transitionIncidentStatus: async (id, status, reason, solution) => {
        const incident = get().incidents.find((i) => i.id === id);
        if (!incident) {
            toast.error('Incidencia no encontrada');
            throw new Error('Incidencia no encontrada');
        }

        const finalReason = reason !== undefined ? reason : (incident.reason || undefined);

        // Validación optimista para el toast inmediato; la BD vuelve a validar.
        if (status === IncidentStatus.IN_REVIEW && !finalReason?.trim()) {
            toast.error('Indica el motivo para pasar a En Revisión');
            throw new Error('Falta motivo');
        }
        if (status === IncidentStatus.RESOLVED) {
            if (!finalReason?.trim()) {
                toast.error('Indica el motivo antes de resolver la incidencia');
                throw new Error('Falta motivo');
            }
            if (!solution?.trim()) {
                toast.error('Indica la solución para resolver la incidencia');
                throw new Error('Falta solución');
            }
        }

        const resolvedAt = status === IncidentStatus.RESOLVED ? new Date().toISOString() : null;
        const resolvedBy = status === IncidentStatus.RESOLVED ? get().currentUser?.id : null;

        try {
            // RPC atómica: valida transiciones, exige motivo/solución y sella
            // resolved_at/resolved_by en la BD (no falsificables desde el cliente).
            await incidentService.transition(id, status, finalReason ?? null, solution ?? null);
            set((state) => ({
                incidents: state.incidents.map(inc => inc.id === id ? {
                    ...inc,
                    status,
                    reason: finalReason ?? inc.reason,
                    solution: solution !== undefined ? solution : inc.solution,
                    resolvedAt,
                    resolvedBy,
                    resolvedByName: resolvedBy ? get().currentUser?.name : undefined
                } : inc)
            }));
            toast.success(`Incidencia ${status.toLowerCase()}`);
        } catch (error) {
            throw error;
        }
    },

    addIncidentComment: async (commentData) => {
        try {
            const newComment = await incidentService.addComment(commentData);
            set((state) => ({
                incidents: state.incidents.map(inc => {
                    if (inc.id === commentData.incidentId) {
                        return {
                            ...inc,
                            comments: [...(inc.comments || []), newComment as IncidentComment]
                        };
                    }
                    return inc;
                })
            }));
        } catch (error) {
            toast.error('Error al añadir comentario');
            throw error;
        }
    },

    convertToWorkOrder: async (incidentId, woData) => {
        try {
            // RPC atómica e idempotente: crea la OT (+ subtareas + adjuntos),
            // marca la incidencia como 'Convertida a OT' y añade el comentario
            // de sistema. Si ya existe una OT para esta incidencia la devuelve
            // (UNIQUE en work_orders.related_incident_id).
            const workOrderId = await incidentService.convertToWorkOrder(incidentId, {
                title: woData.title,
                section: woData.section,
                description: woData.description,
                type: woData.type,
                priority: woData.priority,
                equipmentId: woData.equipmentId,
                assignedUserId: woData.assignedUserId,
                scheduledDate: woData.scheduledDate,
                subtasks: woData.subtasks || [],
                attachments: (woData.attachments?.length ? woData.attachments : [])
            });

            set((state) => ({
                incidents: state.incidents.map(inc => inc.id === incidentId ? {
                    ...inc,
                    status: IncidentStatus.CONVERTED,
                    workOrderId,
                    section: woData.section
                } : inc)
            }));

            // La OT llega por realtime; la refrescamos para tenerla ya en store.
            const workOrders = await workOrderService.getAll();
            set({ workOrders });

            toast.success('Incidencia convertida a OT correctamente');
        } catch (error) {
            console.error('Error converting incident:', error);
            toast.error('Error al convertir incidencia');
            throw error;
        }
    }
});
