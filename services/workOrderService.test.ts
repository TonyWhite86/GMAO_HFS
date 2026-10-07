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

        it('NO manda created_by: lo pone la BD (DEFAULT auth.uid())', async () => {
            const woChain = buildChain({ id: 'wo-uid' });
            mockFrom
                .mockReturnValueOnce(woChain)
                .mockReturnValueOnce(buildChain(null));

            await workOrderService.create({
                id: '', title: 'T', description: '', type: 'Correctivo' as any,
                status: 'Pendiente' as any, priority: 'Alta' as any,
                equipmentId: 'e1', section: 'Planta', createdBy: 'spoofed-id',
                createdAt: '2026-07-15', comments: [], attachments: [],
                subtasks: [{ id: '', description: 'S', completed: false }],
                usedParts: [], collaborators: []
            });

            const payload = woChain.insert.mock.calls[0][0][0];
            expect(payload).not.toHaveProperty('created_by');
        });
    });

    describe('update', () => {
        it('NO manda status_history/time_spent_minutes/closed_at: los posee la BD', async () => {
            const chain = buildChain({ id: 'wo1' });
            mockFrom.mockReturnValueOnce(chain);

            await workOrderService.update({
                id: 'wo1', title: 'T', description: '', type: 'Correctivo' as any,
                status: 'En Progreso' as any, priority: 'Alta' as any,
                equipmentId: 'e1', section: 'Planta', createdBy: 'u1',
                createdAt: '2026-07-15', attachments: [], usedParts: [],
                collaborators: [], subtasks: [], comments: [],
                statusHistory: [{ status: 'En Progreso', timestamp: 'x' }],
                timeSpentMinutes: 999, closedAt: '2026-07-15'
            } as any);

            const payload = chain.update.mock.calls[0][0];
            expect(payload).not.toHaveProperty('status_history');
            expect(payload).not.toHaveProperty('time_spent_minutes');
            expect(payload).not.toHaveProperty('closed_at');
            expect(payload).not.toHaveProperty('created_at');
        });

        it('NO manda status: los cambios de estado pasan por transition_work_order', async () => {
            const chain = buildChain({ id: 'wo1' });
            mockFrom.mockReturnValueOnce(chain);

            await workOrderService.update({
                id: 'wo1', title: 'T', description: '', type: 'Correctivo' as any,
                status: 'Completada' as any, priority: 'Alta' as any,
                equipmentId: 'e1', section: 'Planta', createdBy: 'u1',
                createdAt: '2026-07-15', attachments: [], usedParts: [],
                collaborators: [], subtasks: [], comments: []
            } as any);

            const payload = chain.update.mock.calls[0][0];
            expect(payload).not.toHaveProperty('status');
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

        it('NO manda user_id/user_name: los pone la BD (DEFAULT + trigger)', async () => {
            const chain = buildChain({ id: 'c-uid', user_id: 'auth-uid', user_name: 'Ana', attachments: [] });
            mockFrom.mockReturnValueOnce(chain);

            await workOrderService.addComment({
                id: '', userId: 'spoofed', userName: 'Falso', text: 'hola',
                createdAt: '2026-07-15', attachments: []
            }, 'wo1');

            const payload = chain.insert.mock.calls[0][0][0];
            expect(payload).not.toHaveProperty('user_id');
            expect(payload).not.toHaveProperty('user_name');
            // y el retorno usa los valores reales de la BD
            expect(payload.text).toBe('hola');
        });
    });
});
