import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);
        setMatches(mql.matches);
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
};

// Matches Tailwind's `md` breakpoint so it aligns with the rest of the app
// (e.g. `hidden md:flex`). Below this width the grid is not usable.
export const useIsMobile = (): boolean => useMediaQuery('(max-width: 767px)');
