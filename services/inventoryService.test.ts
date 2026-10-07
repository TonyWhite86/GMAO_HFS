import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inventoryService } from './inventoryService';
import { stoppageService } from './stoppageService';

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
        rpc: vi.fn()
    }
}));

import { supabase } from '../lib/supabase';

const mockFrom = supabase.from as any;

function buildChain(data: any = null, error: any = null) {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.lte = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.range = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data, error });
    chain.then = (resolve: any) => Promise.resolve(resolve({ data, error }));
    return chain;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('inventoryService', () => {
    it('getAll lee de inventory_browse (price/supplier enmascarados)', async () => {
        const chain = buildChain([{ id: 'i1', name: 'Tornillo', sku: 'T-1', price: null, supplier: null }]);
        mockFrom.mockReturnValueOnce(chain);

        await inventoryService.getAll();
        expect(mockFrom).toHaveBeenCalledWith('inventory_browse');
    });

    it('getById lee de inventory_browse', async () => {
        const chain = buildChain({ id: 'i1', name: 'Tornillo' });
        mockFrom.mockReturnValueOnce(chain);

        await inventoryService.getById('i1');
        expect(mockFrom).toHaveBeenCalledWith('inventory_browse');
    });

    it('update sigue escribiendo en la tabla inventory', async () => {
        const chain = buildChain({ id: 'i1', name: 'Tornillo', sku: 'T-1' });
        mockFrom.mockReturnValueOnce(chain);

        await inventoryService.update({
            id: 'i1', name: 'Tornillo', sku: 'T-1', manufacturer: '', quantity: 1,
            minStock: 0, category: '', location: '', price: 0, supplier: '',
            qrCode: '', critic: 'Media', status: 'Active', image: '', linkedEquipmentIds: []
        } as any);
        expect(mockFrom).toHaveBeenCalledWith('inventory');
    });
});

describe('stoppageService', () => {
    it('NO manda created_by/requested_by: los pone la BD (DEFAULT auth.uid())', async () => {
        const chain = buildChain({ id: 'st1' });
        mockFrom.mockReturnValueOnce(chain);

        await stoppageService.create({
            equipmentId: 'eq1',
            title: 'Parada',
            reasonType: 'Mantenimiento' as any,
            startAt: '2026-07-14T08:00:00Z',
            endAt: '2026-07-14T12:00:00Z',
            status: 'Programada' as any,
            requestedBy: 'spoofed-1',
            createdBy: 'spoofed-2'
        } as any);

        const payload = chain.insert.mock.calls[0][0][0];
        expect(payload).not.toHaveProperty('created_by');
        expect(payload).not.toHaveProperty('requested_by');
    });

    it('update NO manda quantity: el stock solo se mueve por register_inventory_movement', async () => {
        const chain = buildChain({ id: 'i1', name: 'X', sku: 'S', quantity: 0 });
        mockFrom.mockReturnValueOnce(chain);

        await inventoryService.update({
            id: 'i1', name: 'X', sku: 'S', manufacturer: '', quantity: 99,
            minStock: 0, category: '', location: '', price: 0, supplier: '',
            qrCode: '', critic: 'Media', status: 'Active', image: '', linkedEquipmentIds: []
        } as any);

        const payload = chain.update.mock.calls[0][0];
        expect(payload).not.toHaveProperty('quantity');
    });
});
