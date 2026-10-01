import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useMediaQuery, useIsMobile } from './useMediaQuery';

interface MockMQL {
  matches: boolean;
  media: string;
  listeners: Array<(e: { matches: boolean }) => void>;
}

const mqls: MockMQL[] = [];
let queryResult: (query: string) => boolean;

const installMatchMedia = () => {
  mqls.length = 0;
  const mock = (query: string) => {
    const mql: MockMQL = { matches: queryResult(query), media: query, listeners: [] };
    mqls.push(mql);
    return {
      get matches() {
        return mql.matches;
      },
      set matches(v: boolean) {
        mql.matches = v;
      },
      media: mql.media,
      addEventListener: (_ev: string, cb: (e: { matches: boolean }) => void) => {
        mql.listeners.push(cb);
      },
      removeEventListener: (_ev: string, cb: (e: { matches: boolean }) => void) => {
        mql.listeners = mql.listeners.filter(l => l !== cb);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    };
  };
  window.matchMedia = mock as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  queryResult = () => false;
  installMatchMedia();
});

afterEach(cleanup);

describe('useMediaQuery', () => {
  it('devuelve el estado inicial de la query', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('lee el valor inicial de matchMedia.matches', () => {
    queryResult = q => q === '(min-width: 768px)';
    installMatchMedia();
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('reacciona a los cambios de la query', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    const mql = mqls[mqls.length - 1];
    act(() => {
      mql.listeners.forEach(l => l({ matches: true }));
    });
    expect(result.current).toBe(true);
  });

  it('limpia el listener al desmontar', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(mqls[mqls.length - 1].listeners).toHaveLength(1);
    unmount();
    expect(mqls[mqls.length - 1].listeners).toHaveLength(0);
  });
});

describe('useIsMobile', () => {
  it('usa el breakpoint md de Tailwind (max-width: 767px)', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    expect(mqls.some(m => m.media === '(max-width: 767px)')).toBe(true);
  });
});
