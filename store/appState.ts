import type { AuthSlice } from './slices/createAuthSlice';
import type { SectionSlice } from './slices/createSectionSlice';
import type { EquipmentSlice } from './slices/createEquipmentSlice';
import type { WorkOrderSlice } from './slices/createWorkOrderSlice';
import type { InventorySlice } from './slices/createInventorySlice';
import type { PreventivePlanSlice } from './slices/createPreventivePlanSlice';
import type { PurchaseOrderSlice } from './slices/createPurchaseOrderSlice';
import type { UISlice } from './slices/createUISlice';
import type { IncidentSlice } from './slices/createIncidentSlice';
import type { DataSlice } from './slices/createDataSlice';
import type { PermissionSlice } from './slices/createPermissionSlice';

export type AppState =
    AuthSlice &
    SectionSlice &
    EquipmentSlice &
    WorkOrderSlice &
    InventorySlice &
    PreventivePlanSlice &
    PurchaseOrderSlice &
    UISlice &
    IncidentSlice &
    DataSlice &
    PermissionSlice;
