import { describe, it, expect, vi, beforeEach } from 'vitest';
import { incidentService } from './incidentService';
import { IncidentStatus } from '../types';

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
    },
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
    });
});
