import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StoppageFormModal } from './StoppageFormModal';
import {
    Equipment,
    EquipmentStoppage,
    StoppageReasonType,
    StoppageStatus,
    User,
    UserRole
} from '../../../types';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() }
}));

const equipment: Equipment[] = [{
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
}];

const admin: User = {
    id: 'u1', name: 'Admin', email: '', role: UserRole.ADMIN, sections: [], active: true
};

const stoppage = (over: Partial<EquipmentStoppage> = {}): EquipmentStoppage => ({
    id: 'st1',
    equipmentId: 'eq1',
    title: 'Cambio de variador',
    reasonType: StoppageReasonType.MAINTENANCE,
    startAt: '2026-07-14T08:00:00.000Z',
    endAt: '2026-07-15T16:00:00.000Z',
    status: StoppageStatus.SCHEDULED,
    createdAt: '2026-07-01T00:00:00',
    ...over
});

const baseProps = (over: Partial<React.ComponentProps<typeof StoppageFormModal>> = {}) => ({
    isOpen: true,
    onClose: vi.fn(),
    stoppage: null as EquipmentStoppage | null,
    equipment,
    currentUser: admin,
    canManage: true,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...over
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe('StoppageFormModal', () => {
    it('no renderiza nada si isOpen es false', () => {
        render(<StoppageFormModal {...baseProps({ isOpen: false })} />);
        expect(screen.queryByText('Nueva Parada Programada')).toBeNull();
    });

    it('muestra error si el fin no es posterior al inicio', async () => {
        const props = baseProps({ initialEquipmentId: 'eq1' });
        render(<StoppageFormModal {...props} />);

        fireEvent.change(screen.getByPlaceholderText('Ej. Cambio de variador en torno 3'), {
            target: { value: 'Parada mensual' }
        });
        const inputs = document.querySelectorAll('input[type="datetime-local"]');
        fireEvent.change(inputs[0], { target: { value: '2026-07-14T10:00' } });
        fireEvent.change(inputs[1], { target: { value: '2026-07-14T10:00' } });

        fireEvent.click(screen.getByText('Programar Parada'));

        expect(toast.error).toHaveBeenCalledWith('El fin debe ser posterior al inicio');
        expect(props.onCreate).not.toHaveBeenCalled();
    });

    it('crea una parada con status Programada', async () => {
        const props = baseProps({ initialEquipmentId: 'eq1' });
        render(<StoppageFormModal {...props} />);

        fireEvent.change(screen.getByPlaceholderText('Ej. Cambio de variador en torno 3'), {
            target: { value: 'Parada mensual' }
        });
        const inputs = document.querySelectorAll('input[type="datetime-local"]');
        fireEvent.change(inputs[0], { target: { value: '2026-07-14T10:00' } });
        fireEvent.change(inputs[1], { target: { value: '2026-07-14T14:00' } });

        await act(async () => {
            fireEvent.click(screen.getByText('Programar Parada'));
        });

        expect(props.onCreate).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Parada mensual',
            equipmentId: 'eq1',
            status: StoppageStatus.SCHEDULED,
            requestedBy: admin.id,
            createdBy: admin.id
        }));
    });

    it('con campos obligatorios vacíos no llama a onCreate', async () => {
        const props = baseProps({ initialEquipmentId: 'eq1' });
        render(<StoppageFormModal {...props} />);

        const title = screen.getByPlaceholderText('Ej. Cambio de variador en torno 3') as HTMLInputElement;
        expect(title.required).toBe(true);

        fireEvent.click(screen.getByText('Programar Parada'));

        expect(props.onCreate).not.toHaveBeenCalled();
    });

    it('al editar llama a onUpdate con los cambios', async () => {
        const props = baseProps({ stoppage: stoppage() });
        render(<StoppageFormModal {...props} />);

        fireEvent.change(screen.getByDisplayValue('Cambio de variador'), {
            target: { value: 'Cambio de variador v2' }
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Guardar Cambios'));
        });

        expect(props.onUpdate).toHaveBeenCalledWith('st1', expect.objectContaining({
            title: 'Cambio de variador v2'
        }));
        expect(props.onCreate).not.toHaveBeenCalled();
    });

    it('muestra los botones de transición de estado solo si canManage', () => {
        render(<StoppageFormModal {...baseProps({ stoppage: stoppage() })} />);
        expect(screen.getByText('Iniciar Parada')).toBeTruthy();
        expect(screen.getByText('Completar')).toBeTruthy();
        expect(screen.getByText('Cancelar')).toBeTruthy();
    });

    it('oculta los botones de transición si la parada está completada', () => {
        render(<StoppageFormModal {...baseProps({ stoppage: stoppage({ status: StoppageStatus.COMPLETED }) })} />);
        expect(screen.queryByText('Iniciar Parada')).toBeNull();
        expect(screen.queryByText('Completar')).toBeNull();
        expect(screen.queryByText('Cancelar')).toBeNull();
    });

    it('con canManage=false los campos quedan deshabilitados', () => {
        render(<StoppageFormModal {...baseProps({ stoppage: stoppage(), canManage: false })} />);
        const title = screen.getByDisplayValue('Cambio de variador') as HTMLInputElement;
        expect(title.disabled).toBe(true);
        const datetimes = document.querySelectorAll('input[type="datetime-local"]');
        expect((datetimes[0] as HTMLInputElement).disabled).toBe(true);
        expect((datetimes[1] as HTMLInputElement).disabled).toBe(true);
    });

    it('con canManage=false no muestra el botón de guardar', () => {
        render(<StoppageFormModal {...baseProps({ stoppage: stoppage(), canManage: false })} />);
        expect(screen.queryByText('Guardar Cambios')).toBeNull();
        expect(screen.getByText('Cerrar')).toBeTruthy();
    });

    it('eliminar pide confirmación antes de llamar a onDelete', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        const props = baseProps({ stoppage: stoppage() });
        render(<StoppageFormModal {...props} />);

        await act(async () => {
            fireEvent.click(screen.getByText('Eliminar'));
        });

        expect(confirmSpy).toHaveBeenCalled();
        expect(props.onDelete).toHaveBeenCalledWith('st1');
        confirmSpy.mockRestore();
    });

    it('si se rechaza la confirmación no elimina', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const props = baseProps({ stoppage: stoppage() });
        render(<StoppageFormModal {...props} />);

        await act(async () => {
            fireEvent.click(screen.getByText('Eliminar'));
        });

        expect(props.onDelete).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
