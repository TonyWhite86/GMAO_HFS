import { StateCreator } from 'zustand';

export type ThemeId = 'azul' | 'claro' | 'oscuro' | 'suave';

export const THEME_IDS: ThemeId[] = ['azul', 'claro', 'oscuro', 'suave'];
const THEME_STORAGE_KEY = 'gmao-theme';

function readStoredTheme(): ThemeId | null {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_IDS.includes(stored as ThemeId) ? (stored as ThemeId) : null;
}

function detectInitialTheme(): ThemeId {
    const stored = readStoredTheme();
    if (stored) return stored;
    // Sin preferencia guardada: el sistema decide entre azul (día) y oscuro (noche).
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
    creationMode: boolean;
    setCreationMode: (mode: boolean) => void;
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
    // Compatibilidad: "modo oscuro" = tema oscuro.
    isDarkMode: detectInitialTheme() === 'oscuro',
    toggleTheme: () => {
        const next: ThemeId = get().isDarkMode ? 'azul' : 'oscuro';
        get().setTheme(next);
    },
    activeModule: 'dashboard',
    setActiveModule: (module) => set({ activeModule: module }),
    creationMode: false,
    setCreationMode: (mode) => set({ creationMode: mode }),
    isLoading: false,
    error: null,
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
});
