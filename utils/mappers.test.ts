import { describe, it, expect } from 'vitest';
import {
    mapProfile, mapSection, mapEquipment, mapWorkOrder,
    mapInventoryItem, mapPreventivePlan, mapPurchaseOrder,
    mapIncident, mapComment, mapIncidentComment, mapSubtask,
    mapAttachment, mapInventoryMovement, mapIncidentCategory,
    mapEquipmentStoppage
} from './mappers';

describe('mapProfile', () => {
    it('mapea snake_case del DB a camelCase', () => {
        const raw = {
            id: 'u1', name: 'Juan', email: 'juan@test.com',
            role: 'Técnico', sections: ['Almacén', 'Planta'], active: true, avatar: 'url'
        };
        const result = mapProfile(raw);
        expect(result.id).toBe('u1');
        expect(result.name).toBe('Juan');
        expect(result.role).toBe('Técnico');
        expect(result.sections).toEqual(['Almacén', 'Planta']);
        expect(result.active).toBe(true);
    });

    it('retorna array vacío si sections no es array', () => {
        const raw = { id: 'u1', sections: null };
        expect(mapProfile(raw).sections).toEqual([]);
    });
});

describe('mapProfile (email en profile_emails)', () => {
    it('lee el email del join emails:profile_emails', () => {
        const r = mapProfile({ id: 'u1', name: 'Ana', role: 'Admin', emails: [{ email: 'ana@x.com' }] });
        expect(r.email).toBe('ana@x.com');
    });

    it('conserva el email del store cuando el payload no lo trae (realtime)', () => {
        const existing = { id: 'u1', name: 'Ana', email: 'ana@x.com', role: 'Admin', sections: [], active: true } as any;
        const r = mapProfile({ id: 'u1', name: 'Ana', role: 'Admin' }, existing);
        expect(r.email).toBe('ana@x.com');
    });

    it('sin email y sin existing queda null (no-admin enmascarado)', () => {
        expect(mapProfile({ id: 'u1', name: 'Ana' }).email).toBeNull();
    });
});

describe('mapSection', () => {
    it('convierte is_special y created_at', () => {
        const raw = { id: 's1', name: 'Planta', is_special: true, created_at: '2026-01-01' };
        const result = mapSection(raw);
        expect(result.isSpecial).toBe(true);
        expect(result.createdAt).toBe('2026-01-01');
    });

    it('convierte is_wildcard y usa false por defecto', () => {
        expect(mapSection({ id: 's1', name: 'Mantenimiento', is_wildcard: true }).isWildcard).toBe(true);
        expect(mapSection({ id: 's2', name: 'Calidad', is_wildcard: false }).isWildcard).toBe(false);
        expect(mapSection({ id: 's3', name: 'Legacy' }).isWildcard).toBe(false);
    });
});

describe('mapEquipment', () => {
    it('mapea todos los campos snake_case', () => {
        const raw = {
            id: 'e1', name: 'Bomba', manufacturer: 'Siemens',
            serial_number: 'SN-123', location: 'Planta A',
            status: 'En Producción', parent_id: 'e0',
            photo_url: 'photo.jpg', qr_code: 'QR001', code: 'BOM-01'
        };
        const result = mapEquipment(raw);
        expect(result.serialNumber).toBe('SN-123');
        expect(result.parentId).toBe('e0');
        expect(result.photoUrl).toBe('photo.jpg');
        expect(result.qrCode).toBe('QR001');
    });

    it('filtra attachments por parent_id y parent_type', () => {
        const raw = { id: 'e1', name: 'Bomba' };
        const attachments = [
            { id: 'a1', parent_id: 'e1', parent_type: 'equipment', name: 'manual.pdf', url: 'url', type: 'file', created_at: '2026-01-01' },
            { id: 'a2', parent_id: 'e2', parent_type: 'equipment', name: 'otro.pdf', url: 'url', type: 'file' },
            { id: 'a3', parent_id: 'e1', parent_type: 'work_order', name: 'wo.pdf', url: 'url', type: 'file' },
        ];
        const result = mapEquipment(raw, attachments);
        expect(result.documents).toHaveLength(1);
        expect(result.documents[0].name).toBe('manual.pdf');
    });
});

describe('mapWorkOrder', () => {
    it('mapea todos los campos principales', () => {
        const raw = {
            id: 'wo1', title: 'Reparar bomba', description: 'Fuga',
            type: 'Correctivo', status: 'Pendiente', priority: 'Alta',
            equipment_id: 'e1', assigned_user_id: 'u1', section: 'Planta',
            created_by: 'u1', created_at: '2026-07-15',
            scheduled_date: '2026-07-20', closed_at: null,
            time_spent_minutes: 120, pending_reason: 'Falta pieza',
            audio_note_url: 'audio.mp3', collaborators: ['u2', 'u3'],
            collaborating_sections: ['Almacén'], used_parts: [{ partId: 'p1', quantity: 2 }],
            related_plan_id: 'plan1', related_incident_id: 'inc1'
        };
        const result = mapWorkOrder(raw);
        expect(result.equipmentId).toBe('e1');
        expect(result.assignedUserId).toBe('u1');
        expect(result.scheduledDate).toBe('2026-07-20');
        expect(result.timeSpentMinutes).toBe(120);
        expect(result.collaborators).toEqual(['u2', 'u3']);
        expect(result.usedParts).toEqual([{ partId: 'p1', quantity: 2 }]);
    });

    it('mapea comentarios anidados', () => {
        const raw = {
            id: 'wo1', comments: [{
                id: 'c1', user_id: 'u1', user_name: 'Juan',
                text: 'Completado', is_system: true, status: 'Completada',
                created_at: '2026-07-15', attachments: []
            }]
        };
        const result = mapWorkOrder(raw);
        expect(result.comments).toHaveLength(1);
        expect(result.comments[0].userId).toBe('u1');
        expect(result.comments[0].isSystem).toBe(true);
    });

    it('mapea subtareas', () => {
        const raw = {
            id: 'wo1', subtasks: [{
                id: 'st1', description: 'Limpiar filtro', completed: false,
                assigned_user_ids: ['u1']
            }]
        };
        const result = mapWorkOrder(raw);
        expect(result.subtasks).toHaveLength(1);
        expect(result.subtasks![0].assignedUserIds).toEqual(['u1']);
    });

    it('mapea time_source / time_recorded_by / time_recorded_at', () => {
        const raw = {
            id: 'wo1', title: 'X', time_spent_minutes: 12, time_source: 'manual',
            time_recorded_by: 'u9', time_recorded_at: '2026-10-02T18:20:00Z'
        };
        const r = mapWorkOrder(raw);
        expect(r.timeSource).toBe('manual');
        expect(r.timeRecordedBy).toBe('u9');
        expect(r.timeRecordedAt).toBe('2026-10-02T18:20:00Z');
    });

    it('time_source es null cuando no viene', () => {
        expect(mapWorkOrder({ id: 'wo1' }).timeSource).toBeNull();
    });

    it('conserva subtasks del store cuando el payload no las trae (realtime)', () => {
        const existing = {
            id: 'wo1',
            subtasks: [{ id: 'st1', description: 'Fijar bridas', completed: false, assignedUserIds: [] }],
            comments: [{ id: 'c1', userId: 'u1', userName: 'Ana', text: 'hola', createdAt: 'x' }],
            attachments: []
        } as any;
        // postgres_changes manda solo las columnas de work_orders: sin joins
        const raw = { id: 'wo1', title: 'Reparar bomba', status: 'En Progreso' };
        const result = mapWorkOrder(raw, [], existing);
        expect(result.subtasks).toHaveLength(1);
        expect(result.subtasks![0].description).toBe('Fijar bridas');
        expect(result.comments).toHaveLength(1);
    });

    it('respeta un array vacío real de subtasks (borrado legítimo)', () => {
        const existing = {
            id: 'wo1',
            subtasks: [{ id: 'st1', description: 'Fijar bridas', completed: false, assignedUserIds: [] }],
            comments: [],
            attachments: []
        } as any;
        const raw = { id: 'wo1', title: 'Reparar bomba', subtasks: [] };
        const result = mapWorkOrder(raw, [], existing);
        expect(result.subtasks).toHaveLength(0);
    });

    it('sin existing y sin joins, subtasks y comments quedan vacías', () => {
        const result = mapWorkOrder({ id: 'wo1', title: 'X' });
        expect(result.subtasks).toEqual([]);
        expect(result.comments).toEqual([]);
    });

    it('filtra attachments por parent_id y parent_type work_order', () => {
        const raw = { id: 'wo1', comments: [] };
        const attachments = [
            { id: 'a1', parent_id: 'wo1', parent_type: 'work_order', name: 'foto.jpg', url: 'url', type: 'image' },
            { id: 'a2', parent_id: 'wo2', parent_type: 'work_order', name: 'otro.jpg', url: 'url', type: 'image' },
        ];
        const result = mapWorkOrder(raw, attachments);
        expect(result.attachments).toHaveLength(1);
    });

    it('usa existing.attachments como fallback cuando no hay allAttachments', () => {
        const raw = { id: 'wo1', comments: [] };
        const existing = { attachments: [{ id: 'a1', name: 'old.jpg', url: 'url', type: 'image' as const }] };
        const result = mapWorkOrder(raw, [], existing as any);
        expect(result.attachments).toEqual(existing.attachments);
    });

    it('usa existing.attachments como fallback cuando allAttachments no tiene coincidencias', () => {
        const raw = { id: 'wo1', comments: [] };
        const attachments = [
            { id: 'a1', parent_id: 'wo2', parent_type: 'work_order', name: 'otro.jpg', url: 'url', type: 'image' },
        ];
        const existing = { attachments: [{ id: 'a1', name: 'old.jpg', url: 'url', type: 'image' as const }] };
        const result = mapWorkOrder(raw, attachments, existing as any);
        expect(result.attachments).toEqual(existing.attachments);
    });
});

describe('mapInventoryItem', () => {
    it('mapea campos principales', () => {
        const raw = {
            id: 'i1', name: 'Filtro', sku: 'FIL-001', quantity: 50,
            min_stock: 10, category: 'Filtros', location: 'Almacén',
            price: '25.50', supplier: 'Proveedor', qr_code: 'QR-FIL',
            critic: 'Alta', status: 'Active', linked_equipment_ids: ['e1']
        };
        const result = mapInventoryItem(raw);
        expect(result.minStock).toBe(10);
        expect(result.qrCode).toBe('QR-FIL');
        expect(result.price).toBe(25.50);
        expect(result.linkedEquipmentIds).toEqual(['e1']);
    });

    it('parsea price si viene como string', () => {
        const raw = { price: '100.00' };
        expect(mapInventoryItem(raw).price).toBe(100);
    });

    it('usa status por defecto Active', () => {
        const raw = {};
        expect(mapInventoryItem(raw).status).toBe('Active');
    });
});

describe('mapPreventivePlan', () => {
    it('mapea campos snake_case', () => {
        const raw = {
            id: 'p1', name: 'Plan A', description: 'Desc',
            equipment_id: 'e1', frequency_days: 30,
            last_run: '2026-06-01', next_run: '2026-07-01',
            tasks: [{ id: 't1', description: 'Tarea' }], section: 'Planta'
        };
        const result = mapPreventivePlan(raw);
        expect(result.equipmentId).toBe('e1');
        expect(result.frequencyDays).toBe(30);
        expect(result.tasks).toHaveLength(1);
    });
});

describe('mapPurchaseOrder', () => {
    it('mapea campos principales e items', () => {
        const raw = {
            id: 'po1', number: 'PO-001', supplier: 'Prov',
            status: 'Solicitado', requested_by: 'u1', requested_date: '2026-07-15',
            total_amount: 500, created_by: 'u1',
            items: [{ id: 'i1', order_id: 'po1', part_id: 'p1', quantity: 10, unit_price: 50, received_quantity: 0, equipment_id: 'e1' }]
        };
        const result = mapPurchaseOrder(raw);
        expect(result.number).toBe('PO-001');
        expect(result.totalAmount).toBe(500);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].orderId).toBe('po1');
    });
});

describe('mapIncident', () => {
    it('mapea campos principales', () => {
        const raw = {
            id: 'inc1', title: 'Fuga', description: 'Detalles',
            priority: 'Alta', status: 'Abierta', created_by: 'u1',
            created_at: '2026-07-15', section: 'Planta',
            equipment_id: 'e1', work_order_id: null, display_id: 'INC-001'
        };
        const result = mapIncident(raw);
        expect(result.status).toBe('Abierta');
        expect(result.displayId).toBe('INC-001');
    });

    it('extrae creatorName del join creator', () => {
        const raw = { creator: { name: 'Juan' } };
        expect(mapIncident(raw).creatorName).toBe('Juan');
    });

    it('mapea comments de incident_comments', () => {
        const raw = {
            comments: [{
                id: 'ic1', incident_id: 'inc1', user_id: 'u1',
                user_name: 'Juan', text: 'Hola', is_system: false,
                created_at: '2026-07-15'
            }]
        };
        const result = mapIncident(raw);
        expect(result.comments).toHaveLength(1);
        expect(result.comments![0].incidentId).toBe('inc1');
    });

    it('mapea categoría, motivo, solución y resolución', () => {
        const raw = {
            id: 'inc1',
            category_id: 'cat1',
            category: { name: 'Calidad' },
            reason: 'Falta de material',
            solution: 'Reposición de stock',
            resolved_at: '2026-07-20',
            resolved_by: 'u2',
            resolver: { name: 'Ana' }
        };
        const result = mapIncident(raw);
        expect(result.categoryId).toBe('cat1');
        expect(result.categoryName).toBe('Calidad');
        expect(result.reason).toBe('Falta de material');
        expect(result.solution).toBe('Reposición de stock');
        expect(result.resolvedAt).toBe('2026-07-20');
        expect(result.resolvedByName).toBe('Ana');
    });
});

describe('mapComment', () => {
    it('mapea campos con fallback userId', () => {
        const raw = { id: 'c1', user_name: 'Juan', text: 'OK', is_system: false, created_at: '2026-07-15' };
        expect(mapComment(raw).userId).toBe('system');
    });

    it('usa user_id si existe', () => {
        const raw = { id: 'c1', user_id: 'u1' };
        expect(mapComment(raw).userId).toBe('u1');
    });
});

describe('mapIncidentComment', () => {
    it('mapea todos los campos', () => {
        const raw = {
            id: 'ic1', incident_id: 'inc1', user_id: 'u1',
            user_name: 'Juan', text: 'Test', is_system: false,
            created_at: '2026-07-15', attachments: []
        };
        const result = mapIncidentComment(raw);
        expect(result.incidentId).toBe('inc1');
        expect(result.attachments).toEqual([]);
    });
});

describe('mapIncidentCategory', () => {
    it('mapea categoría con visibilidad', () => {
        const raw = {
            id: 'cat1', name: 'Material', is_active: true, sort_order: 2,
            visible_sections: ['Almacén y Logística'], visible_roles: ['Admin'],
            created_at: '2026-07-15'
        };
        const result = mapIncidentCategory(raw);
        expect(result.name).toBe('Material');
        expect(result.visibleSections).toEqual(['Almacén y Logística']);
        expect(result.visibleRoles).toEqual(['Admin']);
    });

    it('usa arrays vacíos por defecto', () => {
        const result = mapIncidentCategory({ id: 'c', name: 'X', is_active: true, sort_order: 0 });
        expect(result.visibleSections).toEqual([]);
        expect(result.visibleRoles).toEqual([]);
    });

    it('convierte is_default y usa false por defecto', () => {
        expect(mapIncidentCategory({ id: 'c', name: 'Avería', is_default: true }).isDefault).toBe(true);
        expect(mapIncidentCategory({ id: 'c', name: 'X', is_default: false }).isDefault).toBe(false);
        expect(mapIncidentCategory({ id: 'c', name: 'Legacy' }).isDefault).toBe(false);
    });
});

describe('mapEquipmentStoppage', () => {
    it('mapea todos los campos con joins', () => {
        const raw = {
            id: 's1', equipment_id: 'e1', equipment: { name: 'Torno' },
            title: 'Mejora variador', description: 'Cambio',
            reason_type: 'Mejora', start_at: '2026-08-01T08:00:00Z',
            end_at: '2026-08-01T14:00:00Z', status: 'Programada',
            requested_by: 'u1', requester: { name: 'Luis' },
            work_order_id: null, created_by: 'u1', created_at: '2026-07-15'
        };
        const result = mapEquipmentStoppage(raw);
        expect(result.equipmentName).toBe('Torno');
        expect(result.reasonType).toBe('Mejora');
        expect(result.requestedByName).toBe('Luis');
        expect(result.status).toBe('Programada');
    });
});

describe('mapEquipmentStoppage (paradas abiertas)', () => {
    it('mapea incident_id y permite end_at null (parada abierta)', () => {
        const r = mapEquipmentStoppage({
            id: 'st1', equipment_id: 'eq1', incident_id: 'inc1',
            title: 'Parada', reason_type: 'Mantenimiento',
            start_at: '2026-10-02T14:30:00Z', end_at: null,
            status: 'En curso', created_at: '2026-10-02T14:30:00Z'
        });
        expect(r.incidentId).toBe('inc1');
        expect(r.endAt).toBeNull();
    });

    it('reasonLabel sale de la categoría de la incidencia cuando la hay', () => {
        const r = mapEquipmentStoppage({
            id: 'st1', equipment_id: 'eq1', incident_id: 'inc1',
            reason_type: null,
            incident: { category: { name: 'Avería' } },
            start_at: '2026-10-02T14:30:00Z', end_at: null, status: 'En curso'
        });
        expect(r.reasonLabel).toBe('Avería');
        expect(r.reasonType).toBeNull();
    });

    it('reasonLabel cae a reason_type en paradas planificadas', () => {
        const r = mapEquipmentStoppage({
            id: 'st1', equipment_id: 'eq1', incident_id: null,
            reason_type: 'Mantenimiento', start_at: '2026-10-02T14:30:00Z', status: 'Programada'
        });
        expect(r.reasonLabel).toBe('Mantenimiento');
        expect(r.reasonType).toBe('Mantenimiento');
    });

    it('endAt sigue mapeándose cuando hay fin', () => {
        const r = mapEquipmentStoppage({
            id: 'st1', equipment_id: 'eq1', end_at: '2026-10-02T16:00:00Z', status: 'Completada'
        });
        expect(r.endAt).toBe('2026-10-02T16:00:00Z');
        expect(r.incidentId).toBeNull();
    });
});

describe('mapSubtask', () => {
    it('mapea campos con assigned_user_ids', () => {
        const raw = { id: 'st1', description: 'Tarea', completed: true, assigned_user_ids: ['u1', 'u2'] };
        const result = mapSubtask(raw);
        expect(result.completed).toBe(true);
        expect(result.assignedUserIds).toEqual(['u1', 'u2']);
    });

    it('retorna array vacío si assigned_user_ids es null', () => {
        const raw = { id: 'st1', assigned_user_ids: null };
        expect(mapSubtask(raw).assignedUserIds).toEqual([]);
    });
});

describe('mapAttachment', () => {
    it('mapea campos básicos', () => {
        const raw = { id: 'a1', name: 'doc.pdf', url: 'https://url', type: 'pdf' };
        const result = mapAttachment(raw);
        expect(result.name).toBe('doc.pdf');
        expect(result.type).toBe('pdf');
    });
});

describe('mapInventoryMovement', () => {
    it('mapea campos con joins anidados', () => {
        const raw = {
            id: 'm1', item_id: 'i1', type: 'IN', quantity: 10,
            reason: 'Compra', user_id: 'u1', created_at: '2026-07-15',
            item: { name: 'Filtro', sku: 'FIL-001' },
            user: { name: 'Juan' }
        };
        const result = mapInventoryMovement(raw);
        expect(result.itemId).toBe('i1');
        expect(result.itemName).toBe('Filtro');
        expect(result.userName).toBe('Juan');
    });
});
