export enum UserRole {
  ADMIN = 'Admin',
  SECTION_MANAGER = 'Responsable Sección',
  TECHNICIAN = 'Técnico',
  OBSERVER_L1 = 'Observador N1',
  OBSERVER_L2 = 'Observador N2',
}

export enum WOStatus {
  PENDING = 'Pendiente',
  SCHEDULED = 'Programada',
  IN_PROGRESS = 'En Progreso',
  COMPLETED = 'Completada',
}

export enum WOPriority {
  LOW = 'Baja',
  MEDIUM = 'Media',
  HIGH = 'Alta',
  CRITICAL = 'Crítica',
}

export enum WOType {
  CORRECTIVE = 'Correctivo',
  PREVENTIVE = 'Preventivo',
  PLANNED = 'Actuación Programada',
}

export type CriticLevel = 'Alta' | 'Media' | 'Baja';

export type SortKey = string;

export type PermissionLevel = 'sin_acceso' | 'consulta' | 'parcial' | 'total';

export interface UserPermission {
  id: string;
  userId: string;
  module: string;
  level: PermissionLevel;
  createdAt?: string;
}

export interface Section {
  id: string;
  name: string;
  isSpecial: boolean;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sections: string[];
  active: boolean;
  avatar?: string;
}

export interface EquipmentDocument {
  id: string;
  name: string;
  type: 'file' | 'folder';
  url?: string;
  parentId?: string;
  size?: string;
  date: string;
}

export interface SupplierInfo {
  id: string;
  name: string;
  lastPrice: number;
  lastDate: string;
  lastQuantity: number;
}

export interface Equipment {
  id: string;
  name: string;
  manufacturer: string;
  serialNumber: string;
  location: string;
  status: 'Nuevo' | 'En Producción' | 'Almacén' | 'Reparación' | 'Averiado' | 'Inactivo' | 'Baja';
  sections: string[];
  parentId?: string; // For tree structure
  photoUrl?: string;
  qrCode: string;
  code?: string;
  documents: EquipmentDocument[];
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  manufacturer?: string;
  quantity: number;
  minStock: number;
  category: string;
  location: string;
  price: number;
  supplier: string;
  qrCode: string;
  critic: CriticLevel;
  status: 'Active' | 'Draft';
  image?: string;
  suppliers?: SupplierInfo[];
  linkedEquipmentIds?: string[];
}

export type InventoryMovementType = 'IN' | 'OUT';

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName?: string;
  itemSku?: string;
  type: InventoryMovementType;
  quantity: number;
  reason?: string;
  userId: string;
  userName?: string; // Optional, loaded via relation
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file' | 'video' | 'pdf';
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  isSystem?: boolean; // For auto-generated messages like status changes
  status?: WOStatus; // New field to track status color
  attachments?: Attachment[];
}

export interface SubTask {
  id: string;
  description: string;
  assignedUserIds?: string[]; // Multiple users for this task
  completed: boolean;
}

export interface WorkOrder {
  id: string; // Keep as required, but I'll fix the modals to provide empty string
  title: string;
  description: string;
  type: WOType;
  status: WOStatus;
  priority: WOPriority;
  statusHistory?: { status: WOStatus; timestamp: string; }[];
  collaboratingSections?: string[];
  equipmentId: string;
  assignedUserId?: string; // Main responsible
  collaborators?: string[]; // Additional assigned technicians
  assignedGroupId?: string; // Group assignment
  createdBy: string;
  createdAt: string;
  scheduledDate?: string;
  closedAt?: string;
  timeSpentMinutes?: number;
  section: string;
  audioNoteUrl?: string;
  attachments: Attachment[];
  usedParts: { partId: string; quantity: number }[];
  pendingReason?: string;
  comments: Comment[];
  relatedPlanId?: string; // ID of the preventive plan if applicable
  relatedIncidentId?: string; // ID of the incident that triggered this WO
  subtasks?: SubTask[];
}

export interface PreventivePlan {
  id: string;
  name: string;
  description?: string;
  equipmentId: string;
  frequencyDays: number;
  tasks: SubTask[];
  lastRun?: string;
  nextRun: string;
  assignedGroupId?: string;
  section?: string;
}

export enum POStatus {
  REQUESTED = 'Solicitado',
  DRAFT = 'Borrador',
  ORDERED = 'Pedido',
  PARTIAL = 'Recibido Parcial',
  RECEIVED = 'Recibido',
  CANCELLED = 'Cancelado',
}

export interface PurchaseOrderItem {
  id: string;
  orderId: string;
  partId: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
  equipmentId?: string; // Target equipment for tracking
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplier?: string; // Optional for requests
  status: POStatus;
  requestedBy: string; // User ID
  requestedDate: string;
  orderDate?: string;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  totalAmount: number;
  createdBy: string;
  items: PurchaseOrderItem[];
}

export enum IncidentStatus {
  OPEN = 'Abierta',
  IN_REVIEW = 'En Revisión',
  CONVERTED = 'Convertida a OT',
  RESOLVED = 'Resuelta',
  CANCELLED = 'Cancelada',
}

export interface IncidentComment {
  id: string;
  incidentId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  isSystem?: boolean;
  attachments?: Attachment[];
}

export interface Incident {
  id: string;
  displayId?: string;
  title: string;
  description: string;
  priority: WOPriority;
  status: IncidentStatus;
  createdBy: string; // User ID
  creatorName?: string; // Loaded via join
  createdAt: string;
  section?: string;
  equipmentId?: string | null;
  workOrderId?: string | null; // Linked WO if converted
  attachments?: Attachment[];
  comments?: IncidentComment[];
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  category: string;
  createdAt: string;
}

export interface UserSkill {
  id: string;
  userId: string;
  skillId: string;
  level: number; // 0-5
  validationDate?: string;
  createdAt: string;
}

export interface UserSkillMatrix extends UserSkill {
  skill?: Skill;
  user?: User;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}