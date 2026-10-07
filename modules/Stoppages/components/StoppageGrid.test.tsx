import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoppageGrid } from './StoppageGrid';
import {
    Equipment,
    EquipmentStoppage,
    StoppageReasonType,
    StoppageStatus
} from '../../../types';

const equipment: Equipment[] = [
    {
        id: 'eq1',
        name: 'Torno CNC',
        manufacturer: 'Haas',
        serialNumber: 'SN-1',
        location: 'Planta',
        status: 'En Producción',
        sections: ['Planta'],
        qrCode: 'QR1',
        code: 'T-01',
        documents: []
    },
    {
        id: 'eq2',
        name: 'Fresadora',
        manufacturer: 'Fagor',
        serialNumber: 'SN-2',
        location: 'Planta',
        status: 'En Producción',
        sections: ['Planta'],
        qrCode: 'QR2',
        documents: []
    }
];

const days = [
    new Date(2026, 6, 13), // lun 13 jul
    new Date(2026, 6, 14),
    new Date(2026, 6, 15),
    new Date(2026, 6, 16),
    new Date(2026, 6, 17),
    new Date(2026, 6, 18),
    new Date(2026, 6, 19)
];

const stoppage = (over: Partial<EquipmentStoppage> = {}): EquipmentStoppage => ({
    id: 'st1',
    equipmentId: 'eq1',
    title: 'Cambio de variador',
    reasonType: StoppageReasonType.MAINTENANCE,
    startAt: new Date(2026, 6, 14, 8, 0, 0).toISOString(),
    endAt: new Date(2026, 6, 15, 16, 0, 0).toISOString(),
    status: StoppageStatus.SCHEDULED,
    createdAt: '2026-07-01T00:00:00',
    ...over
});

const baseProps = (over: Partial<React.ComponentProps<typeof StoppageGrid>> = {}) => ({
    equipment,
    daysToShow: days,
    stoppages: [] as EquipmentStoppage[],
    canManage: true,
    onSelectStoppage: vi.fn(),
    onCreateAtSlot: vi.fn(),
    ...over
});

describe('StoppageGrid', () => {
    it('renderiza los equipos de la lista', () => {
        render(<StoppageGrid {...baseProps()} />);
        expect(screen.getByText('[T-01] Torno CNC')).toBeTruthy();
        expect(screen.getByText('Fresadora')).toBeTruthy();
    });

    it('no muestra el código cuando el equipo no lo tiene', () => {
        render(<StoppageGrid {...baseProps()} />);
        expect(screen.queryByText(/Fresadora/)).toBeTruthy();
        expect(screen.queryByText('[Fresadora]')).toBeNull();
    });

    it('no dibuja barras cuando no hay paradas', () => {
        render(<StoppageGrid {...baseProps()} />);
        expect(screen.queryByText('Cambio de variador')).toBeNull();
    });

    it('dibuja la barra de la parada y llama a onSelectStoppage al pulsarla', () => {
        const props = baseProps({ stoppages: [stoppage()] });
        render(<StoppageGrid {...props} />);
        const bar = screen.getByTitle(/Cambio de variador/);
        fireEvent.click(bar);
        expect(props.onSelectStoppage).toHaveBeenCalledWith(expect.objectContaining({ id: 'st1' }));
    });

    it('marca como cancelada la parada con Cancelada', () => {
        render(<StoppageGrid {...baseProps({ stoppages: [stoppage({ status: StoppageStatus.CANCELLED })] })} />);
        const bar = screen.getByTitle(/Cambio de variador/);
        expect(bar.className).toContain('line-through');
        expect(bar.className).toContain('opacity-50');
    });

    it('llama a onCreateAtSlot con el equipo y la fecha al pulsar una celda', () => {
        const props = baseProps();
        render(<StoppageGrid {...props} />);
        const cells = screen.getAllByTitle('Programar parada en esta fecha');
        // eq1 tiene 7 celdas; pulsamos la segunda (14 jul)
        fireEvent.click(cells[1]);
        expect(props.onCreateAtSlot).toHaveBeenCalledWith('eq1', days[1]);
    });

    it('con canManage=false las celdas no disparan onCreateAtSlot', () => {
        const props = baseProps({ canManage: false });
        render(<StoppageGrid {...props} />);
        expect(screen.queryAllByTitle('Programar parada en esta fecha')).toHaveLength(0);
        const cells = screen.getAllByRole('button').filter(b => !b.title);
        fireEvent.click(cells[1]);
        expect(props.onCreateAtSlot).not.toHaveBeenCalled();
    });

    it('muestra mensaje vacío cuando no hay equipos', () => {
        render(<StoppageGrid {...baseProps({ equipment: [] })} />);
        expect(screen.getByText('No hay equipos')).toBeTruthy();
    });

    it('una parada abierta (sin endAt) se dibuja con el indicador de curso', () => {
        render(<StoppageGrid {...baseProps({
            stoppages: [stoppage({ endAt: null, status: StoppageStatus.IN_PROGRESS })]
        })} />);
        const bar = screen.getByTitle(/Parada abierta|Cambio de variador/);
        expect(bar).toBeTruthy();
        expect(bar.querySelector('.animate-pulse')).toBeTruthy();
    });

    it('no revienta cuando reason_type es desconocido (categoría a medida)', () => {
        render(<StoppageGrid {...baseProps({
            stoppages: [stoppage({ reasonType: 'Avería personalizada' as any })]
        })} />);
        expect(screen.getByText('Cambio de variador')).toBeTruthy();
    });
});
