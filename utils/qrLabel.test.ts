import { describe, it, expect } from 'vitest';
import { labelFileName, formatStockLabel, QRLabelData } from './qrLabel';

const data = (over: Partial<QRLabelData>): QRLabelData => ({
    value: 'QR-1', code: 'REP-001', name: 'Rodamiento 6204', ...over
});

describe('labelFileName', () => {
    it('nombre de archivo seguro a partir del código', () => {
        expect(labelFileName(data({}))).toBe('etiqueta-REP-001.png');
    });

    it('sanitiza caracteres no válidos y acentos', () => {
        expect(labelFileName(data({ code: 'MT/01 Añálisis' }))).toBe('etiqueta-MT-01-Analisis.png');
    });

    it('usa el nombre si no hay código y corta a 40 caracteres', () => {
        const name = 'Equipo de prueba con un nombre muy largo para recortar';
        const file = labelFileName(data({ code: '', name }));
        expect(file.startsWith('etiqueta-Equipo-de-prueba')).toBe(true);
        expect(file.endsWith('.png')).toBe(true);
    });
});

describe('formatStockLabel', () => {
    it('formatea el stock', () => {
        expect(formatStockLabel(12)).toBe('Stock: 12');
        expect(formatStockLabel('5 uds')).toBe('Stock: 5 uds');
    });

    it('sin stock no muestra etiqueta', () => {
        expect(formatStockLabel(null)).toBeNull();
        expect(formatStockLabel(undefined)).toBeNull();
        expect(formatStockLabel('')).toBeNull();
    });
});
