import { StateCreator } from 'zustand';

export interface UISlice {
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

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
    // matchMedia is not implemented in every environment (jsdom, SSR), so fall
    // back to light mode when it is unavailable.
    isDarkMode: typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false,
    toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
    activeModule: 'dashboard',
    setActiveModule: (module) => set({ activeModule: module }),
    creationMode: false,
    setCreationMode: (mode) => set({ creationMode: mode }),
    isLoading: false,
    error: null,
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
});
