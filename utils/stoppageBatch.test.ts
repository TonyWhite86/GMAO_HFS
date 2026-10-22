import { describe, it, expect } from 'vitest';
import { expandStoppageScope, describeStoppageScope } from './stoppageBatch';
import { Equipment, EquipmentGroup } from '../types';

const eq = (id: string, name: string, over: Partial<Equipment> = {}): Equipment => ({
    id,
    name,
    manufacturer: '',
    serialNumber: '',
    location: 'Planta A',
    status: 'En Producción',
    sections: [],
    qrCode: '',
    documents: [],
    ...over
});

const equipment: Equipment[] = [
    eq('e1', 'Compresor', { location: 'Planta A' }),
    eq('e2', 'Bomba', { location: 'Planta A' }),
    eq('e3', 'Enfriadora', { location: 'Nave 2' }),
    eq('e4', 'Vieja', { location: 'Planta A', status: 'Baja' }),
    eq('e5', 'Parada', { location: 'Planta A', status: 'Inactivo' })
];

const groups: EquipmentGroup[] = [
    { id: 'g1', name: 'Línea 1', equipmentIds: ['e1', 'e3'], active: true, createdAt: '2026-01-01' },
    { id: 'g2', name: 'Vacío', equipmentIds: [], active: true, createdAt: '2026-01-01' }
];

describe('expandStoppageScope', () => {
    it('single: solo ese equipo', () => {
        expect(expandStoppageScope(equipment, { kind: 'single', equipmentId: 'e2' }, groups))
            .toEqual(['e2']);
    });

    it('multiple: los elegidos, deduplicados y ordenados por nombre', () => {
        expect(expandStoppageScope(equipment, { kind: 'multiple', equipmentIds: ['e3', 'e1', 'e1'] }, groups))
            .toEqual(['e1', 'e3']);
    });

    it('group: expande los equipos del grupo', () => {
        expect(expandStoppageScope(equipment, { kind: 'group', groupId: 'g1' }, groups))
            .toEqual(['e1', 'e3']);
    });

    it('group desconocido o vacío: sin equipos', () => {
        expect(expandStoppageScope(equipment, { kind: 'group', groupId: 'nope' }, groups)).toEqual([]);
        expect(expandStoppageScope(equipment, { kind: 'group', groupId: 'g2' }, groups)).toEqual([]);
    });

    it('location: los equipos de esa ubicación que estén operativos', () => {
        expect(expandStoppageScope(equipment, { kind: 'location', location: 'Planta A' }, groups))
            .toEqual(['e2', 'e1']);
    });

    it('plant: todos los operativos, sin importar ubicación', () => {
        expect(expandStoppageScope(equipment, { kind: 'plant' }, groups))
            .toEqual(['e2', 'e1', 'e3']);
    });

    it('excluye equipos en Baja o Inactivo', () => {
        const ids = expandStoppageScope(equipment, { kind: 'plant' }, groups);
        expect(ids).not.toContain('e4');
        expect(ids).not.toContain('e5');
    });

    it('un equipo elegido que está en Baja tampoco entra', () => {
        expect(expandStoppageScope(equipment, { kind: 'single', equipmentId: 'e4' }, groups))
            .toEqual([]);
    });
});

describe('describeStoppageScope', () => {
    it('describe cada alcance', () => {
        expect(describeStoppageScope({ kind: 'single', equipmentId: 'e1' })).toBe('Un equipo');
        expect(describeStoppageScope({ kind: 'multiple', equipmentIds: ['e1', 'e2'] })).toBe('2 equipos elegidos');
        expect(describeStoppageScope({ kind: 'group', groupId: 'g1' })).toBe('Grupo');
        expect(describeStoppageScope({ kind: 'location', location: 'Nave 2' })).toBe('Ubicación: Nave 2');
        expect(describeStoppageScope({ kind: 'plant' })).toBe('Toda la planta');
    });
});
