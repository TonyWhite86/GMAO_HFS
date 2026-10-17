import { describe, it, expect } from 'vitest';
import {
    buildEquipmentTree, getAncestorIds, getEquipmentPath, defaultExpandedIds
} from './equipmentTree';
import { Equipment } from '../types';

const eq = (id: string, name: string, parentId?: string): Equipment => ({
    id, name, parentId,
    manufacturer: '', serialNumber: '', location: '',
    status: 'Nuevo', sections: [], qrCode: `QR-${id}`, documents: []
});

// Planta
//  ├── Línea B
//  │    └── Motor
//  └── Línea A
//       └── Bomba
// (y un huérfano cuyo padre no existe)
const list = [
    eq('planta', 'Planta'),
    eq('linea-b', 'Línea B', 'planta'),
    eq('linea-a', 'Línea A', 'planta'),
    eq('motor', 'Motor', 'linea-b'),
    eq('bomba', 'Bomba', 'linea-a'),
    eq('huerfano', 'Huérfano', 'no-existe')
];

describe('buildEquipmentTree', () => {
    it('anida por parentId y ordena alfabéticamente en cada nivel', () => {
        const tree = buildEquipmentTree(list);
        expect(tree.map(n => n.equipment.id)).toEqual(['huerfano', 'planta']);
        const planta = tree.find(n => n.equipment.id === 'planta')!;
        expect(planta.children.map(n => n.equipment.id)).toEqual(['linea-a', 'linea-b']);
        expect(planta.children[1].children.map(n => n.equipment.id)).toEqual(['motor']);
    });

    it('el huérfano (padre ausente) se trata como raíz', () => {
        const tree = buildEquipmentTree([eq('huerfano', 'Huérfano', 'no-existe')]);
        expect(tree).toHaveLength(1);
        expect(tree[0].children).toHaveLength(0);
    });

    it('lista vacía', () => {
        expect(buildEquipmentTree([])).toEqual([]);
    });
});

describe('getAncestorIds', () => {
    it('devuelve la rama del más lejano al padre directo', () => {
        expect(getAncestorIds(list, 'motor')).toEqual(['planta', 'linea-b']);
    });

    it('raíz sin ancestros y desconocido también', () => {
        expect(getAncestorIds(list, 'planta')).toEqual([]);
        expect(getAncestorIds(list, 'no-existe')).toEqual([]);
    });
});

describe('getEquipmentPath', () => {
    it('ruta legible con separador', () => {
        expect(getEquipmentPath(list, 'motor')).toBe('Planta > Línea B > Motor');
    });

    it('sin padres devuelve solo el nombre', () => {
        expect(getEquipmentPath(list, 'huerfano')).toBe('Huérfano');
    });
});

describe('defaultExpandedIds', () => {
    it('expande raíces y la rama del seleccionado', () => {
        const expanded = defaultExpandedIds(list, 'motor');
        expect(expanded.has('planta')).toBe(true);
        expect(expanded.has('linea-b')).toBe(true);
        expect(expanded.has('linea-a')).toBe(false);
        expect(expanded.has('huerfano')).toBe(true);
    });

    it('sin selección solo las raíces', () => {
        const expanded = defaultExpandedIds(list, null);
        expect([...expanded].sort()).toEqual(['huerfano', 'planta']);
    });
});
