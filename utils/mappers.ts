import {
    WorkOrder, Equipment, InventoryItem, PreventivePlan,
    PurchaseOrder, Incident, User, Section, Attachment,
    Comment, SubTask, IncidentComment, IncidentStatus, WorkOrderEvent,
    Skill, UserSkill, InventoryMovement, UserPermission,
    IncidentCategory, EquipmentStoppage, StoppageReasonType, StoppageStatus
} from '../types';

export const mapSkill = (s: any): Skill => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    createdAt: s.created_at
});

export const mapUserSkill = (us: any): UserSkill => ({
    id: us.id,
    userId: us.user_id,
    skillId: us.skill_id,
    level: us.level,
    validationDate: us.validation_date,
    createdAt: us.created_at
});

export const mapProfile = (u: any, existing?: User): User => ({
    id: u.id,
    name: u.name,
    // El email vive en profile_emails (RLS sólo-Admin). Los joins y el realtime
    // no lo traen: se conserva el que ya tuviéramos en el store.
    email: u.email ?? u.emails?.[0]?.email ?? existing?.email ?? null,
    role: u.role,
    sections: Array.isArray(u.sections) ? u.sections : [],
    active: u.active,
    avatar: u.avatar
});

export const mapSection = (s: any): Section => ({
    id: s.id,
    name: s.name,
    isSpecial: s.is_special,
    isWildcard: s.is_wildcard ?? false,
    createdAt: s.created_at
});

export const mapEquipment = (e: any, allAttachments: any[] = []): Equipment => ({
    id: e.id,
    name: e.name,
    manufacturer: e.manufacturer,
    serialNumber: e.serial_number,
    location: e.location,
    status: e.status,
    sections: Array.isArray(e.sections) ? e.sections : [],
    parentId: e.parent_id,
    photoUrl: e.photo_url,
    qrCode: e.qr_code,
    code: e.code,
    documents: (allAttachments || [])
        .filter((a: any) => a.parent_id === e.id && a.parent_type === 'equipment')
        .map((a: any) => ({
            id: a.id,
            name: a.name,
            type: a.type as 'file' | 'folder',
            url: a.url,
            date: a.created_at || new Date().toISOString()
        }))
});

// Maps DB attachments belonging to a WO. Falls back to the existing client list
// when no DB attachment matches, so in-progress edits don't wipe local attachments.
const mapAttachments = (wo: any, allAttachments: any[] = [], existing?: WorkOrder): Attachment[] => {
    const mapped = (allAttachments || [])
        .filter((a: any) => a.parent_id === wo.id && a.parent_type === 'work_order')
        .map((a: any): Attachment => ({
            id: a.id,
            name: a.name,
            url: a.url,
            type: a.type as Attachment['type']
        }));
    return mapped.length > 0 ? mapped : (existing?.attachments || []);
};

// `postgres_changes` (realtime) y los `.select()` sin join no traen las filas
// embebidas: `wo.subtasks` / `wo.comments` son `undefined`. En ese caso caemos
// back a lo que ya teníamos en el store, para no borrar tareas ni comentarios
// con cada UPDATE de la OT. Un array vacío real (`[]`) sí se respeta.
const mapJoinedComments = (wo: any, existing?: WorkOrder): Comment[] => {
    if (!Array.isArray(wo.comments)) return existing?.comments || [];
    return wo.comments.map((c: any) => ({
        id: c.id,
        userId: c.user_id,
        userName: c.user_name,
        text: c.text,
        isSystem: c.is_system,
        status: c.status,
        createdAt: c.created_at,
        attachments: c.attachments || []
    }));
};

export const mapWorkOrderEvent = (e: any): WorkOrderEvent => ({
    id: e.id,
    workOrderId: e.work_order_id,
    kind: e.kind,
    status: e.status,
    note: e.note,
    actorId: e.actor_id,
    actorName: e.actor_name,
    createdAt: e.created_at
});

const mapJoinedEvents = (wo: any, existing?: WorkOrder): WorkOrderEvent[] => {
    if (!Array.isArray(wo.events)) return existing?.events || [];
    return wo.events.map(mapWorkOrderEvent);
};

const mapJoinedSubtasks = (wo: any, existing?: WorkOrder): SubTask[] => {
    if (!Array.isArray(wo.subtasks)) return existing?.subtasks || [];
    return wo.subtasks.map((st: any) => ({
        id: st.id,
        description: st.description,
        completed: st.completed,
        assignedUserIds: st.assigned_user_ids
    }));
};

export const mapWorkOrder = (wo: any, allAttachments: any[] = [], existing?: WorkOrder): WorkOrder => ({
    id: wo.id,
    title: wo.title,
    description: wo.description,
    type: wo.type,
    status: wo.status,
    priority: wo.priority,
    equipmentId: wo.equipment_id,
    assignedUserId: wo.assigned_user_id,
    collaborators: wo.collaborators,
    section: wo.section,
    createdBy: wo.created_by,
    createdAt: wo.created_at,
    scheduledDate: wo.scheduled_date,
    closedAt: wo.closed_at,
    timeSpentMinutes: wo.time_spent_minutes,
    timeSource: wo.time_source ?? null,
    timeRecordedBy: wo.time_recorded_by ?? null,
    timeRecordedAt: wo.time_recorded_at ?? null,
    pendingReason: wo.pending_reason,
    audioNoteUrl: wo.audio_note_url,
    statusHistory: wo.status_history,
    collaboratingSections: wo.collaborating_sections,
    usedParts: wo.used_parts,
    relatedPlanId: wo.related_plan_id,
    relatedIncidentId: wo.related_incident_id,
    attachments: mapAttachments(wo, allAttachments, existing),
    comments: mapJoinedComments(wo, existing),
    subtasks: mapJoinedSubtasks(wo, existing),
    events: mapJoinedEvents(wo, existing)
});

export const mapInventoryItem = (i: any): InventoryItem => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    manufacturer: i.manufacturer,
    quantity: i.quantity,
    minStock: i.min_stock,
    category: i.category,
    location: i.location,
    price: typeof i.price === 'string' ? parseFloat(i.price) : i.price,
    supplier: i.supplier,
    qrCode: i.qr_code,
    critic: i.critic,
    status: i.status || 'Active',
    image: i.image,
    linkedEquipmentIds: i.linked_equipment_ids || []
});

export const mapPreventivePlan = (p: any): PreventivePlan => ({
    id: p.id,
    name: p.name,
    description: p.description,
    equipmentId: p.equipment_id,
    frequencyDays: p.frequency_days,
    lastRun: p.last_run,
    nextRun: p.next_run,
    tasks: p.tasks || [],
    section: p.section
});

export const mapPurchaseOrder = (po: any): PurchaseOrder => ({
    id: po.id,
    number: po.number,
    supplier: po.supplier,
    status: po.status,
    requestedBy: po.requested_by,
    requestedDate: po.requested_date,
    orderDate: po.order_date,
    expectedDate: po.expected_date,
    receivedDate: po.received_date,
    notes: po.notes,
    totalAmount: po.total_amount,
    createdBy: po.created_by, // Current store mapping seems to miss this in po.requested_by logic but types have it
    items: (po.items || []).map((i: any) => ({
        id: i.id,
        orderId: i.order_id,
        partId: i.part_id,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        receivedQuantity: i.received_quantity,
        equipmentId: i.equipment_id
    }))
});

export const mapIncident = (inc: any): Incident => ({
    id: inc.id,
    title: inc.title,
    description: inc.description,
    priority: inc.priority,
    status: inc.status as IncidentStatus,
    categoryId: inc.category_id,
    categoryName: inc.category?.name,
    reason: inc.reason,
    solution: inc.solution,
    resolvedAt: inc.resolved_at,
    resolvedBy: inc.resolved_by,
    resolvedByName: inc.resolver?.name,
    createdBy: inc.created_by,
    creatorName: inc.creator?.name || inc.creator_name,
    createdAt: inc.created_at,
    section: inc.section,
    equipmentId: inc.equipment_id,
    workOrderId: inc.work_order_id,
    attachments: inc.attachments || [],
    displayId: inc.display_id,
    comments: (inc.comments || []).map((c: any) => ({
        id: c.id,
        incidentId: c.incident_id,
        userId: c.user_id,
        userName: c.user_name,
        text: c.text,
        isSystem: c.is_system,
        createdAt: c.created_at,
        attachments: c.attachments || []
    }))
});

export const mapComment = (c: any): Comment => ({
    id: c.id,
    userId: c.user_id || 'system',
    userName: c.user_name,
    text: c.text,
    isSystem: c.is_system,
    status: c.status,
    createdAt: c.created_at,
    attachments: c.attachments || []
});

export const mapIncidentComment = (c: any): IncidentComment => ({
    id: c.id,
    incidentId: c.incident_id,
    userId: c.user_id,
    userName: c.user_name,
    text: c.text,
    isSystem: c.is_system,
    createdAt: c.created_at,
    attachments: c.attachments || []
});

export const mapIncidentCategory = (c: any): IncidentCategory => ({
    id: c.id,
    name: c.name,
    isActive: c.is_active,
    isDefault: c.is_default ?? false,
    sortOrder: c.sort_order,
    visibleSections: c.visible_sections || [],
    visibleRoles: c.visible_roles || [],
    createdAt: c.created_at
});

export const mapEquipmentStoppage = (s: any): EquipmentStoppage => ({
    id: s.id,
    equipmentId: s.equipment_id,
    equipmentName: s.equipment?.name,
    incidentId: s.incident_id ?? null,
    title: s.title,
    description: s.description,
    reasonType: (s.reason_type ?? null) as StoppageReasonType | null,
    reasonLabel: s.incident?.category?.name || s.reason_type || null,
    startAt: s.start_at,
    endAt: s.end_at ?? null,
    status: s.status as StoppageStatus,
    requestedBy: s.requested_by,
    requestedByName: s.requester?.name,
    workOrderId: s.work_order_id,
    createdBy: s.created_by,
    createdAt: s.created_at
});

export const mapSubtask = (st: any): SubTask => ({
    id: st.id,
    description: st.description,
    completed: st.completed,
    assignedUserIds: st.assigned_user_ids || []
});

export const mapUserPermission = (p: any): UserPermission => ({
    id: p.id,
    userId: p.user_id,
    module: p.module,
    level: p.level,
    createdAt: p.created_at
});

export const mapAttachment = (a: any): Attachment => ({
    id: a.id,
    name: a.name,
    url: a.url,
    type: a.type
});

export const mapInventoryMovement = (m: any): InventoryMovement => ({
    id: m.id,
    itemId: m.item_id,
    itemName: m.item?.name,
    itemSku: m.item?.sku,
    type: m.type,
    quantity: m.quantity,
    reason: m.reason,
    userId: m.user_id,
    userName: m.user?.name, // Assumes a join with profiles as 'user'
    createdAt: m.created_at
});
