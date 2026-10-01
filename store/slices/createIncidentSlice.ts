import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { Incident, IncidentComment, IncidentStatus } from '../../types';
import { incidentService } from '../../services/incidentService';
import { workOrderService } from '../../services/workOrderService';
import { toast } from 'sonner';

export interface IncidentSlice {
    incidents: Incident[];
    setIncidents: (incidents: Incident[]) => void;
    fetchIncidents: () => Promise<void>;
    addIncident: (incident: Partial<Incident>) => Promise<void>;
    updateIncident: (id: string, updates: Partial<Incident>) => Promise<void>;
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
    setIncidents: (incidents) => set({ incidents }),

    fetchIncidents: async () => {
        try {
            const incidents = await incidentService.getAll();
            set({ incidents });
        } catch (error) {
            console.error('Error fetching incidents:', error);
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
            const incident = get().incidents.find((i: any) => i.id === incidentId);
            if (!incident) throw new Error('Incidencia no encontrada');

            let workOrderId = incident.workOrderId;

            // Check if we already have a WO linked to this incident (in case of retry)
            // Or if there is a WO with this relatedIncidentId
            if (!workOrderId) {
                const existingWO = get().workOrders.find((w: any) => w.relatedIncidentId === incidentId);
                if (existingWO) {
                    workOrderId = existingWO.id;
                    console.log('Found existing WO for incident, reusing:', workOrderId);
                }
            }

            // 1. Create Work Order (only if not exists)
            if (!workOrderId) {
                try {
                    const newWO = await get().addWorkOrder({
                        ...woData,
                        attachments: incident.attachments || [],
                        relatedIncidentId: incidentId
                    });
                    workOrderId = newWO.id;
                } catch (error: unknown) {
                    if (isSupabaseConflict(error)) {
                        const existing = get().workOrders.find((w: any) => w.relatedIncidentId === incidentId);
                        if (existing) {
                            workOrderId = existing.id;
                        } else {
                            const dbWO = await workOrderService.getByRelatedIncidentId(incidentId);
                            if (dbWO) {
                                workOrderId = dbWO.id;
                            } else {
                                throw new Error('No se pudo encontrar la OT asociada a la incidencia');
                            }
                        }
                    } else {
                        throw error;
                    }
                }
            }

            // 2. Update Incident status and link to WO
            // This is the critical part that was failing silently or due to permissions
            if (workOrderId) {
                await get().updateIncident(incidentId, {
                    status: IncidentStatus.CONVERTED,
                    workOrderId: workOrderId,
                    section: woData.section
                });

                // 3. Post system comment (idempotent check)
                const currentIncident = get().incidents.find((i) => i.id === incidentId);
                const alreadyCommented = currentIncident?.comments?.some((c) => c.text && c.text.includes(workOrderId));
                if (!alreadyCommented) {
                    await get().addIncidentComment({
                        incidentId,
                        userId: get().currentUser?.id,
                        userName: 'Sistema',
                        text: `Incidencia convertida a Orden de Trabajo: ${workOrderId}`,
                        isSystem: true
                    });
                }

                toast.success('Incidencia convertida a OT correctamente');
            }
        } catch (error) {
            console.error('Error converting incident:', error);
            toast.error('Error al convertir incidencia');
            throw error;
        }
    }
});
