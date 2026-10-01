import { vi } from 'vitest';

// jsdom does not implement `window.matchMedia`. Provide a basic stub so modules
// that read the media query at import time (e.g. the Zustand UI slice) and hooks
// like useMediaQuery do not crash in tests. Individual tests can re-stub
// `window.matchMedia` when they need query-specific behaviour.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
