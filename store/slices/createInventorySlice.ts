import { StateCreator } from 'zustand';
import { InventoryItem } from '../../types';
import { inventoryService } from '../../services/inventoryService';
import { toast } from 'sonner';

export interface InventorySlice {
    inventory: InventoryItem[];
    setInventory: (inventory: InventoryItem[]) => void;
    addInventory: (item: InventoryItem) => Promise<InventoryItem>;
    updateInventory: (item: InventoryItem) => Promise<void>;
    mergeInventoryItems: (keepId: string, deleteId: string) => Promise<void>;
}

export const createInventorySlice: StateCreator<InventorySlice, [], [], InventorySlice> = (set) => ({
    inventory: [],
    setInventory: (inventory) => set({ inventory }),
    addInventory: async (item) => {
        try {
            const newItem = await inventoryService.create(item);
            toast.success('Inventario creado');
            // Prepend logic matching useAppStore
            set((state) => {
                if (state.inventory.find(i => i.id === newItem.id)) return state;
                return { inventory: [newItem, ...state.inventory] };
            });
            return newItem;
        } catch (error) {
            toast.error('Error al crear inventario');
            throw error;
        }
    },
    updateInventory: async (item) => {
        try {
            await inventoryService.update(item);
            toast.success('Inventario actualizado');
            set((state) => ({
                inventory: state.inventory.map(i => i.id === item.id ? item : i)
            }));
        } catch (error) {
            toast.error('Error al actualizar inventario');
            throw error;
        }
    },
    mergeInventoryItems: async (keepId, deleteId) => {
        try {
            await inventoryService.mergeItems(keepId, deleteId);
            const updated = await inventoryService.getById(keepId);
            toast.success('Artículos fusionados correctamente');
            set((state) => ({
                inventory: state.inventory
                    .filter(i => i.id !== deleteId)
                    .map(i => i.id === keepId ? updated : i)
            }));
        } catch (error) {
            toast.error('Error al fusionar artículos');
            throw error;
        }
    }
});
