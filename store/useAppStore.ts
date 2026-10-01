import { create } from 'zustand';
import { AppState } from './appState';
import { createAuthSlice } from './slices/createAuthSlice';
import { createSectionSlice } from './slices/createSectionSlice';
import { createEquipmentSlice } from './slices/createEquipmentSlice';
import { createWorkOrderSlice } from './slices/createWorkOrderSlice';
import { createInventorySlice } from './slices/createInventorySlice';
import { createPreventivePlanSlice } from './slices/createPreventivePlanSlice';
import { createPurchaseOrderSlice } from './slices/createPurchaseOrderSlice';
import { createUISlice } from './slices/createUISlice';
import { createIncidentSlice } from './slices/createIncidentSlice';
import { createDataSlice } from './slices/createDataSlice';
import { createPermissionSlice } from './slices/createPermissionSlice';

export const useAppStore = create<AppState>((...a) => ({
    ...createAuthSlice(...a),
    ...createSectionSlice(...a),
    ...createEquipmentSlice(...a),
    ...createWorkOrderSlice(...a),
    ...createInventorySlice(...a),
    ...createPreventivePlanSlice(...a),
    ...createPurchaseOrderSlice(...a),
    ...createUISlice(...a),
    ...createIncidentSlice(...a),
    ...createDataSlice(...a),
    ...createPermissionSlice(...a),
}));
