import { describe, it, expect } from 'vitest';
import { isAnswered, isChecklistComplete } from './WOChecklistComplete';
import { ChecklistItem } from '../../types';

const items: ChecklistItem[] = [
    { id: 'a', text: 'Presión OK' },
    { id: 'b', text: 'Limpieza hecha' }
];

describe('isAnswered', () => {
    it('contesta con sí/no o con valor', () => {
        expect(isAnswered({ sel: 'si' })).toBe(true);
        expect(isAnswered({ sel: 'no' })).toBe(true);
        expect(isAnswered({ val: '4,5 bar' })).toBe(true);
        expect(isAnswered({ sel: 'si', val: 'ok' })).toBe(true);
    });

    it('sin sel ni valor no está respondido', () => {
        expect(isAnswered(undefined)).toBe(false);
        expect(isAnswered({})).toBe(false);
        expect(isAnswered({ sel: null })).toBe(false);
        expect(isAnswered({ val: '   ' })).toBe(false);
    });
});

describe('isChecklistComplete', () => {
    it('completo cuando todos los puntos tienen respuesta', () => {
        expect(isChecklistComplete(items, { a: { sel: 'si' }, b: { val: 'hecho' } })).toBe(true);
    });

    it('incompleto si falta alguno', () => {
        expect(isChecklistComplete(items, { a: { sel: 'no' } })).toBe(false);
        expect(isChecklistComplete(items, {})).toBe(false);
    });

    it('sin puntos siempre está completo', () => {
        expect(isChecklistComplete([], {})).toBe(true);
    });
});
