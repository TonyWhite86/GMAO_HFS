import { describe, it, expect, vi, beforeEach } from 'vitest';
import { incidentService } from './incidentService';
import { IncidentStatus } from '../types';

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
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data, error });
    chain.then = (resolve: any) => Promise.resolve(resolve({ data, error }));
    return chain;
}

describe('incidentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('retorna incidencias mapeadas', async () => {
            const mockInc = {
                id: 'inc1', title: 'Fuga', description: 'Detalles',
                priority: 'Alta', status: 'Abierta', created_by: 'u1',
                created_at: '2026-07-15', comments: [], creator: { name: 'Juan' }
            };
            mockFrom.mockReturnValueOnce(buildChain([mockInc]));
            const result = await incidentService.getAll();
            expect(result).toHaveLength(1);
            expect(result[0].creatorName).toBe('Juan');
        });
    });

    describe('create', () => {
        it('crea una incidencia con estado por defecto', async () => {
            const newInc = {
                title: 'Nueva', description: 'Desc', priority: 'Alta' as any,
                createdBy: 'u1', section: 'Planta'
            };
            mockFrom.mockReturnValueOnce(buildChain({
                ...newInc, id: 'inc-new', status: IncidentStatus.OPEN,
                created_at: '2026-07-15', comments: []
            }));

            const result = await incidentService.create(newInc);
            expect(result.id).toBe('inc-new');
            expect(result.status).toBe(IncidentStatus.OPEN);
        });

        it('persiste category_id en el insert y trae el join de categoría', async () => {
            const chain = buildChain({
                id: 'inc-cat', title: 'Con categoría', description: 'D',
                priority: 'Alta', status: IncidentStatus.OPEN,
                created_by: 'u1', section: 'Planta', category_id: 'cat1',
                created_at: '2026-07-15', comments: [],
                category: { name: 'Avería' }
            });
            mockFrom.mockReturnValueOnce(chain);

            await incidentService.create({
                title: 'Con categoría', description: 'D',
                priority: 'Alta' as any, createdBy: 'u1', section: 'Planta',
                categoryId: 'cat1'
            });

            expect(chain.insert).toHaveBeenCalledWith([expect.objectContaining({
                category_id: 'cat1'
            })]);
            expect(chain.select).toHaveBeenCalledWith(
                expect.stringContaining('category:category_id(name)')
            );
        });

        it('envía category_id null cuando no hay categoría', async () => {
            const chain = buildChain({
                id: 'inc-nocat', title: 'Sin categoría', description: 'D',
                priority: 'Alta', status: IncidentStatus.OPEN,
                created_by: 'u1', section: 'Planta', category_id: null,
                created_at: '2026-07-15', comments: []
            });
            mockFrom.mockReturnValueOnce(chain);

            await incidentService.create({
                title: 'Sin categoría', description: 'D',
                priority: 'Alta' as any, createdBy: 'u1', section: 'Planta'
            });

            expect(chain.insert).toHaveBeenCalledWith([expect.objectContaining({
                category_id: null
            })]);
        });

        it('NO manda created_by: lo pone la BD (DEFAULT auth.uid())', async () => {
            const chain = buildChain({
                id: 'inc-uid', title: 'T', description: 'D',
                priority: 'Alta', status: IncidentStatus.OPEN,
                created_by: 'auth-uid-real', section: null, category_id: null,
                created_at: '2026-07-15', comments: []
            });
            mockFrom.mockReturnValueOnce(chain);

            await incidentService.create({
                title: 'T', description: 'D',
                priority: 'Alta' as any, createdBy: 'spoofed-user-id', section: ''
            });

            const payload = chain.insert.mock.calls[0][0][0];
            expect(payload).not.toHaveProperty('created_by');
            // section vacía se normaliza a null (visible para todo el mundo)
            expect(payload.section).toBeNull();
        });
    });

    describe('update', () => {
        it('actualiza campos de la incidencia', async () => {
            mockFrom.mockReturnValueOnce(buildChain({
                id: 'inc1', title: 'Fuga', status: 'Resuelta',
                created_at: '2026-07-15'
            }));
            const result = await incidentService.update('inc1', { status: IncidentStatus.RESOLVED });
            expect(result.status).toBe('Resuelta');
        });
    });

    describe('addComment', () => {
        it('inserta comentario en la incidencia', async () => {
            const comment = {
                incidentId: 'inc1', userId: 'u1', userName: 'Juan',
                text: 'Comentario', isSystem: false
            };
            mockFrom.mockReturnValueOnce(buildChain({
                id: 'ic1', incident_id: 'inc1', user_id: 'u1',
                user_name: 'Juan', text: 'Comentario', is_system: false,
                created_at: '2026-07-15'
            }));
            const result = await incidentService.addComment(comment);
            expect(result.incidentId).toBe('inc1');
        });

        it('NO manda user_id/user_name: los pone la BD (DEFAULT + trigger)', async () => {
            const chain = buildChain({
                id: 'ic-uid', incident_id: 'inc1', user_id: 'auth-uid',
                user_name: 'Sistema', text: 'x', is_system: true,
                created_at: '2026-07-15'
            });
            mockFrom.mockReturnValueOnce(chain);

            await incidentService.addComment({
                incidentId: 'inc1', userId: 'spoofed', userName: 'Falso',
                text: 'x', isSystem: true
            });

            const payload = chain.insert.mock.calls[0][0][0];
            expect(payload).not.toHaveProperty('user_id');
            expect(payload).not.toHaveProperty('user_name');
            expect(payload.is_system).toBe(true);
        });
    });

    describe('createWithStoppage', () => {
        it('llama al RPC create_incident_with_stoppage y devuelve los ids', async () => {
            const rpc = vi.fn().mockResolvedValue({
                data: { incident_id: 'inc-1', stoppage_id: 'st-1' }, error: null
            });
            (supabase as any).rpc = rpc;

            const r = await incidentService.createWithStoppage({
                title: 'Avería', description: 'd', priority: 'Alta', categoryId: 'cat1',
                equipmentId: 'eq1', withStoppage: true, stoppageTitle: 'Avería'
            });

            expect(r).toEqual({ incidentId: 'inc-1', stoppageId: 'st-1' });
            expect(rpc).toHaveBeenCalledWith('create_incident_with_stoppage', expect.objectContaining({
                p_with_stoppage: true,
                p_equipment_id: 'eq1'
            }));
            // el motivo de la parada NO se manda: lo aporta la categoría
            expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_stoppage_reason_type');
        });

        it('devuelve stoppageId null cuando no se pide parada', async () => {
            const rpc = vi.fn().mockResolvedValue({
                data: { incident_id: 'inc-1', stoppage_id: null }, error: null
            });
            (supabase as any).rpc = rpc;
            const r = await incidentService.createWithStoppage({
                title: 'A', description: 'd', priority: 'Media', categoryId: 'cat1',
                equipmentId: 'eq1'
            });
            expect(r.stoppageId).toBeNull();
        });
    });

    describe('transition', () => {
        it('llama al RPC transition_incident con los argumentos correctos', async () => {
            const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
            (supabase as any).rpc = rpc;

            await incidentService.transition('inc1', 'Resuelta', 'motivo', 'sol', null);

            expect(rpc).toHaveBeenCalledWith('transition_incident', {
                p_id: 'inc1',
                p_status: 'Resuelta',
                p_reason: 'motivo',
                p_solution: 'sol',
                p_comment: null
            });
        });
    });

    describe('convertToWorkOrder', () => {
        it('llama al RPC convert_incident_to_wo y devuelve el id de la OT', async () => {
            const rpc = vi.fn().mockResolvedValue({ data: 'OT-2026-000001', error: null });
            (supabase as any).rpc = rpc;

            const id = await incidentService.convertToWorkOrder('inc1', {
                title: 'Arreglar', section: 'Planta', subtasks: [], attachments: []
            });

            expect(id).toBe('OT-2026-000001');
            expect(rpc).toHaveBeenCalledWith('convert_incident_to_wo', expect.objectContaining({
                p_incident_id: 'inc1',
                p_title: 'Arreglar',
                p_section: 'Planta'
            }));
        });
    });
});
