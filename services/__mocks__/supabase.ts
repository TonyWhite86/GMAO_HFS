import { vi } from 'vitest';

const chainable = () => {
    const chain: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
    };
    return chain;
};

export const supabase = {
    from: vi.fn(() => chainable()),
    storage: {
        from: vi.fn(() => ({
            remove: vi.fn().mockResolvedValue({ error: null }),
        })),
    },
    getChannels: vi.fn(() => []),
    removeChannel: vi.fn(),
    channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
    })),
};
