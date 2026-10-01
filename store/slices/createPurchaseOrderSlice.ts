import { StateCreator } from 'zustand';
import { PurchaseOrder, POStatus } from '../../types';
import { purchaseOrderService } from '../../services/purchaseOrderService';
import { toast } from 'sonner';

export interface PurchaseOrderSlice {
    purchaseOrders: PurchaseOrder[];
    setPurchaseOrders: (orders: PurchaseOrder[]) => void;
    addPurchaseOrder: (order: Partial<PurchaseOrder>, items: any[]) => Promise<void>;
    updatePurchaseOrder: (order: PurchaseOrder) => Promise<void>;
    deletePurchaseOrder: (id: string) => Promise<void>;
}

export const createPurchaseOrderSlice: StateCreator<PurchaseOrderSlice, [], [], PurchaseOrderSlice> = (set) => ({
    purchaseOrders: [],
    setPurchaseOrders: (purchaseOrders) => set({ purchaseOrders }),
    addPurchaseOrder: async (order, items) => {
        try {
            const newOrder = await purchaseOrderService.create(order, items);
            toast.success(order.status === POStatus.REQUESTED ? 'Solicitud creada' : 'Pedido creado');
            set((state) => {
                if (state.purchaseOrders.find(o => o.id === newOrder.id)) return state;
                return { purchaseOrders: [newOrder, ...state.purchaseOrders] };
            });
        } catch (error) {
            toast.error('Error al crear el pedido');
            throw error;
        }
    },
    updatePurchaseOrder: async (order) => {
        try {
            await purchaseOrderService.update(order);
            toast.success('Pedido actualizado');
            set((state) => ({
                purchaseOrders: state.purchaseOrders.map(o => o.id === order.id ? order : o)
            }));
        } catch (error) {
            toast.error('Error al actualizar el pedido');
            throw error;
        }
    },
    deletePurchaseOrder: async (id) => {
        try {
            await purchaseOrderService.delete(id);
            toast.success('Pedido eliminado');
            set((state) => ({
                purchaseOrders: state.purchaseOrders.filter(o => o.id !== id)
            }));
        } catch (error) {
            toast.error('Error al eliminar el pedido');
            throw error;
        }
    }
});
