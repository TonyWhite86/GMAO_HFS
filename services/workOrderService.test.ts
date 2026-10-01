import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workOrderService } from './workOrderService';

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
        storage: { from: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({ error: null }) })) },
    },
}));

import { supabase } from '../lib/supabase';

const mockFrom = supabase.from as any;

function buildChain(data: any = [], error: any = null) {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data, error });
    chain.then = (resolve: any) => Promise.resolve(resolve({ data, error }));
    return chain;
}

describe('workOrderService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('retorna órdenes de trabajo mapeadas', async () => {
            const mockWO = {
                id: 'wo1', title: 'Test', type: 'Correctivo', status: 'Pendiente',
                priority: 'Alta', section: 'Planta', created_at: '2026-07-15',
                created_by: 'u1', comments: [], subtasks: []
            };
            mockFrom
                .mockReturnValueOnce(buildChain([mockWO]))
                .mockReturnValueOnce(buildChain([]));

            const result = await workOrderService.getAll();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('wo1');
        });

        it('lanza error si falla la consulta', async () => {
            mockFrom.mockReturnValueOnce(buildChain([], { message: 'DB error' }));
            await expect(workOrderService.getAll()).rejects.toThrow();
        });
    });

    describe('create', () => {
        it('crea una orden de trabajo con subtareas', async () => {
            const newWO = {
                id: '', title: 'Nueva', description: '', type: 'Correctivo' as any,
                status: 'Pendiente' as any, priority: 'Alta' as any,
                equipmentId: 'e1', section: 'Planta', createdBy: 'u1',
                createdAt: '2026-07-15', comments: [], attachments: [],
                subtasks: [{ id: '', description: 'Tarea 1', completed: false }],
                usedParts: [], collaborators: []
            };

            mockFrom
                .mockReturnValueOnce(buildChain({ id: 'wo-new' }))  // insert WO
                .mockReturnValueOnce(buildChain(null));               // insert subtasks

            const result = await workOrderService.create(newWO);
            expect(result.id).toBe('wo-new');
            expect(mockFrom).toHaveBeenCalledWith('work_orders');
            expect(mockFrom).toHaveBeenCalledWith('subtasks');
        });
    });

    describe('toggleSubtask', () => {
        it('actualiza estado de subtarea', async () => {
            mockFrom.mockReturnValueOnce(buildChain(null));
            const result = await workOrderService.toggleSubtask('st1', true);
            expect(result).toEqual({ id: 'st1', completed: true });
        });
    });

    describe('addComment', () => {
        it('inserta comentario y retorna con id', async () => {
            const comment = {
                id: '', userId: 'u1', userName: 'Juan', text: 'OK',
                createdAt: '2026-07-15', attachments: []
            };
            mockFrom.mockReturnValueOnce(buildChain({ id: 'c-new', attachments: [] }));
            const result = await workOrderService.addComment(comment, 'wo1');
            expect(result.id).toBe('c-new');
        });
    });
});
