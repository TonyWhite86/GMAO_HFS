import { StateCreator } from 'zustand';

export type ThemeId = 'azul' | 'oscuro';

export const THEME_IDS: ThemeId[] = ['azul', 'oscuro'];
const THEME_STORAGE_KEY = 'gmao-theme';

// Migración: en versiones previas existían 'claro' y 'suave'.
function normalizeTheme(value: string | null): ThemeId | null {
    if (value === 'azul' || value === 'oscuro') return value;
    if (value === 'claro' || value === 'suave') return 'azul';
    return null;
}

function readStoredTheme(): ThemeId | null {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

function detectInitialTheme(): ThemeId {
    const stored = readStoredTheme();
    if (stored) return stored;
    // Sin preferencia guardada: el sistema decide entre claro (día) y oscuro (noche).
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'oscuro';
    }
    return 'azul';
}

export interface UISlice {
    theme: ThemeId;
    setTheme: (theme: ThemeId) => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
    activeModule: string;
    setActiveModule: (module: string) => void;
    isLoading: boolean;
    error: string | null;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
    theme: detectInitialTheme(),
    setTheme: (theme) => {
        if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        }
        set({ theme, isDarkMode: theme === 'oscuro' });
    },
    isDarkMode: detectInitialTheme() === 'oscuro',
    toggleTheme: () => {
        const next: ThemeId = get().isDarkMode ? 'azul' : 'oscuro';
        get().setTheme(next);
    },
    activeModule: 'dashboard',
    setActiveModule: (module) => set({ activeModule: module }),
    isLoading: false,
    error: null,
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
});
