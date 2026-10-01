import { StateCreator } from 'zustand';
import type { AppState } from '../appState';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
    WorkOrder, Equipment, User, Section, InventoryItem,
    PreventivePlan, PurchaseOrder, Incident, Comment,
    SubTask, Attachment, IncidentComment
} from '../../types';
import {
    mapWorkOrder, mapEquipment, mapProfile, mapSection,
    mapInventoryItem, mapPreventivePlan, mapPurchaseOrder,
    mapIncident, mapComment, mapIncidentComment, mapSubtask, mapAttachment,
    mapUserPermission
} from '../../utils/mappers';

// Import services
import { workOrderService } from '../../services/workOrderService';
import { equipmentService } from '../../services/equipmentService';
import { userService } from '../../services/userService';
import { sectionService } from '../../services/sectionService';
import { inventoryService } from '../../services/inventoryService';
import { preventivePlanService } from '../../services/preventivePlanService';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { incidentService } from '../../services/incidentService';
import { permissionService } from '../../services/permissionService';

export interface DataSlice {
    fetchInitialData: () => Promise<void>;
    initializeSubscription: () => () => void;
}

export const createDataSlice: StateCreator<AppState, [], [], DataSlice> = (set, get) => ({
    fetchInitialData: async () => {
        set({ isLoading: true, error: null });

        if (!navigator.onLine) {
            set({ isLoading: false, error: 'Sin conexión a internet. Esperando conexión...' });
            toast.error('Sin conexión a internet', { id: 'offline-error' });
            return;
        }

        const fetchers = [
            { key: 'users' as const, exec: () => userService.getAll(), label: 'usuarios' },
            { key: 'sections' as const, exec: () => sectionService.getAll(), label: 'secciones' },
            { key: 'equipment' as const, exec: () => equipmentService.getAll(), label: 'equipos' },
            { key: 'workOrders' as const, exec: () => workOrderService.getAll(), label: 'órdenes de trabajo' },
            { key: 'inventory' as const, exec: () => inventoryService.getAll(), label: 'inventario' },
            { key: 'preventivePlans' as const, exec: () => preventivePlanService.getAll(), label: 'planes preventivos' },
            { key: 'purchaseOrders' as const, exec: () => purchaseOrderService.getAll(), label: 'órdenes de compra' },
            { key: 'incidents' as const, exec: () => incidentService.getAll(), label: 'incidencias' },
            { key: 'userPermissions' as const, exec: () => permissionService.getAll(), label: 'permisos' },
        ] as const;

        const results = await Promise.allSettled(fetchers.map(f => f.exec()));

        const state: Record<string, any> = { isLoading: false };
        let failedCount = 0;

        results.forEach((result, i) => {
            const { key, label } = fetchers[i];
            if (result.status === 'fulfilled') {
                state[key] = result.value;
            } else {
                state[key] = [];
                failedCount++;
                console.error(`Error cargando ${label}:`, result.reason);
            }
        });

        set(state as any);

        if (failedCount === fetchers.length) {
            set({ error: 'No se pudieron cargar los datos. Comprueba tu conexión.' });
            toast.error('No se pudieron cargar los datos. Comprueba tu conexión.', { id: 'fetch-error' });
        } else if (failedCount > 0) {
            toast.warning(`Algunos datos no se cargaron (${failedCount}/${fetchers.length}). Reintentando...`, { id: 'fetch-error' });
            setTimeout(() => get().fetchInitialData(), 3000);
        }
    },

    initializeSubscription: () => {
        // Remove existing channel if any
        const existingChannel = supabase.getChannels().find(c => c.topic === 'db-changes');
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase.channel('db-changes');

        type MapperFn = (raw: any) => any;
        const subscribeEntity = (table: string, stateKey: string, mapper: MapperFn, prepend = false) => {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
                set((state: any) => {
                    const raw = payload.new as any;
                    const oldId = (payload.old as any)?.id;
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const mapped = mapper(raw);
                        const exists = state[stateKey].find((item: any) => item.id === mapped.id);
                        return {
                            [stateKey]: exists
                                ? state[stateKey].map((item: any) => item.id === mapped.id ? mapped : item)
                                : prepend ? [mapped, ...state[stateKey]] : [...state[stateKey], mapped]
                        };
                    }
                    if (payload.eventType === 'DELETE') return { [stateKey]: state[stateKey].filter((item: any) => item.id !== oldId) };
                    return state;
                });
            });
        };

        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, (payload) => {
            set((state: any) => {
                const rawNew = payload.new as any;
                const oldWoId = (payload.old as any)?.id;

                if (payload.eventType === 'INSERT') {
                    if (!state.workOrders.find((w: any) => w.id === rawNew.id)) {
                        return { workOrders: [mapWorkOrder(rawNew), ...state.workOrders] };
                    }
                }
                if (payload.eventType === 'UPDATE') {
                    const existing = state.workOrders.find((wo: any) => wo.id === rawNew.id);
                    return {
                        workOrders: state.workOrders.map((wo: any) => wo.id === rawNew.id ? mapWorkOrder(rawNew, [], existing) : wo)
                    };
                }
                if (payload.eventType === 'DELETE') {
                    return { workOrders: state.workOrders.filter((wo: any) => wo.id !== oldWoId) };
                }
                return state;
            });
        });

        subscribeEntity('profiles', 'users', mapProfile);
        subscribeEntity('sections', 'sections', mapSection);
        subscribeEntity('equipment', 'equipment', mapEquipment, true);
        subscribeEntity('inventory', 'inventory', mapInventoryItem, true);
        subscribeEntity('preventive_plans', 'preventivePlans', mapPreventivePlan);
        subscribeEntity('user_permissions', 'userPermissions', mapUserPermission);

        channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (payload) => {
                set((state: any) => {
                    const newCommentRaw = payload.new as any;
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const mapped = mapComment(newCommentRaw);
                        return {
                            workOrders: state.workOrders.map((wo: any) => {
                                if (wo.id === newCommentRaw.work_order_id) {
                                    const exists = wo.comments?.some((c: any) => c.id === mapped.id);
                                    if (payload.eventType === 'UPDATE' && exists) {
                                        return { ...wo, comments: wo.comments.map((c: any) => c.id === mapped.id ? mapped : c) };
                                    }
                                    if (!exists) {
                                        return { ...wo, comments: [...(wo.comments || []), mapped] };
                                    }
                                }
                                return wo;
                            })
                        };
                    }
                    if (payload.eventType === 'DELETE') {
                        const oldId = (payload.old as any).id;
                        return {
                            workOrders: state.workOrders.map((wo: any) => ({
                                ...wo,
                                comments: (wo.comments || []).filter((c: any) => c.id !== oldId)
                            }))
                        };
                    }
                    return state;
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, (payload) => {
                set((state: any) => {
                    const raw = payload.new as any;
                    const oldSubtask = payload.old as any;
                    const woId = raw?.work_order_id || oldSubtask?.work_order_id;
                    if (!woId) return state;

                    const mapped = raw ? mapSubtask(raw) : null;
                    return {
                        workOrders: state.workOrders.map((wo: any) => {
                            if (wo.id === woId) {
                                let newSubtasks = [...(wo.subtasks || [])];
                                if (payload.eventType === 'INSERT' && !newSubtasks.find(s => s.id === mapped!.id)) newSubtasks.push(mapped!);
                                else if (payload.eventType === 'UPDATE') newSubtasks = newSubtasks.map(s => s.id === mapped!.id ? mapped! : s);
                                else if (payload.eventType === 'DELETE') newSubtasks = newSubtasks.filter(s => s.id !== oldSubtask.id);
                                return { ...wo, subtasks: newSubtasks };
                            }
                            return wo;
                        })
                    };
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, (payload) => {
                set((state: any) => {
                    const raw = payload.new as any;
                    const oldAtt = payload.old as any;
                    const parentId = raw?.parent_id || oldAtt?.parent_id;
                    const parentType = raw?.parent_type || oldAtt?.parent_type;
                    if (!parentId) return state;
                    const mapped = raw ? mapAttachment(raw) : null;

                    if (parentType === 'work_order') {
                        return {
                            workOrders: state.workOrders.map((wo: any) => {
                                if (wo.id === parentId) {
                                    let newAtts = [...(wo.attachments || [])];
                                    if (payload.eventType === 'INSERT' && !newAtts.find(a => a.id === mapped!.id)) newAtts.push(mapped!);
                                    else if (payload.eventType === 'UPDATE') newAtts = newAtts.map(a => a.id === mapped!.id ? mapped! : a);
                                    else if (payload.eventType === 'DELETE') newAtts = newAtts.filter(a => a.id !== oldAtt.id);
                                    return { ...wo, attachments: newAtts };
                                }
                                return wo;
                            })
                        };
                    }
                    return state;
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, (payload) => {
                set((state: any) => {
                    const raw = payload.new as any;
                    const oldId = (payload.old as any)?.id;
                    if (payload.eventType === 'INSERT') {
                        const exists = state.purchaseOrders.find((o: any) => o.id === raw.id);
                        if (!exists) {
                            if (raw.requested_by !== state.currentUser?.id) {
                                const requester = state.users.find((u: any) => u.id === raw.requested_by);
                                toast.info(`Nueva solicitud: ${raw.number}`, {
                                    icon: '🛒',
                                    description: requester ? `Creada por ${requester.name}` : 'Creada por otro usuario',
                                    duration: 6000
                                });
                            }
                            return { purchaseOrders: [mapPurchaseOrder(raw), ...state.purchaseOrders] };
                        }
                    }
                    if (payload.eventType === 'UPDATE') {
                        const mapped = mapPurchaseOrder(raw);
                        return {
                            purchaseOrders: state.purchaseOrders.map((o: any) => o.id === raw.id ? { ...o, ...mapped } : o)
                        };
                    }
                    if (payload.eventType === 'DELETE') {
                        return { purchaseOrders: state.purchaseOrders.filter((o: any) => o.id !== oldId) };
                    }
                    return state;
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_order_items' }, (payload) => {
                set((state: any) => {
                    const raw = payload.new as any;
                    const oldId = (payload.old as any)?.id;
                    const orderId = raw?.order_id || (payload.old as any)?.order_id;
                    if (!orderId) return state;

                    const item: any = raw ? {
                        id: raw.id,
                        orderId: raw.order_id,
                        partId: raw.part_id,
                        quantity: raw.quantity,
                        unitPrice: raw.unit_price,
                        receivedQuantity: raw.received_quantity,
                        equipmentId: raw.equipment_id
                    } : null;

                    return {
                        purchaseOrders: state.purchaseOrders.map((po: any) => {
                            if (po.id === orderId) {
                                let newItems = [...(po.items || [])];
                                if (payload.eventType === 'INSERT' && !newItems.find(i => i.id === item.id)) newItems.push(item);
                                else if (payload.eventType === 'UPDATE') newItems = newItems.map(i => i.id === item.id ? item : i);
                                else if (payload.eventType === 'DELETE') newItems = newItems.filter(i => i.id !== oldId);
                                return { ...po, items: newItems };
                            }
                            return po;
                        })
                    };
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
                set((state: any) => {
                    const raw = payload.new as any;
                    const oldId = (payload.old as any)?.id;
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const mapped = mapIncident(raw);
                        const exists = state.incidents.find((i: any) => i.id === raw.id);
                        return {
                            incidents: exists
                                ? state.incidents.map((i: any) => i.id === raw.id ? { ...i, ...mapped } : i)
                                : [mapped, ...state.incidents]
                        };
                    }
                    if (payload.eventType === 'DELETE') return { incidents: state.incidents.filter((i: any) => i.id !== oldId) };
                    return state;
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_comments' }, (payload) => {
                set((state: any) => {
                    const raw = payload.new as any;
                    const incidentId = raw?.incident_id || (payload.old as any)?.incident_id;
                    if (!incidentId) return state;

                    const mapped = raw ? mapIncidentComment(raw) : null;
                    return {
                        incidents: state.incidents.map((inc: any) => {
                            if (inc.id === incidentId) {
                                let newComments = [...(inc.comments || [])];
                                if (payload.eventType === 'INSERT' && !newComments.find(c => c.id === mapped!.id)) newComments.push(mapped!);
                                else if (payload.eventType === 'UPDATE') newComments = newComments.map(c => c.id === mapped!.id ? mapped! : c);
                                else if (payload.eventType === 'DELETE') newComments = newComments.filter(c => c.id !== (payload.old as any).id);
                                return { ...inc, comments: [...newComments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) };
                            }
                            return inc;
                        })
                    };
                });
            })
            .subscribe();

        return () => {
            const ch = supabase.getChannels().find(c => c.topic === 'db-changes');
            if (ch) supabase.removeChannel(ch);
        };
    }
});
