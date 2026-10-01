import { useState, useMemo } from 'react';

export interface SortConfig<K> {
    key: K;
    direction: 'asc' | 'desc';
}

/**
 * Generic hook for sorting a list of items.
 * @param data Array of items to sort.
 * @param initialSort Optional initial sort configuration.
 * @param customSortFns Optional dictionary of custom comparison functions for specific keys.
 */
export const useSortableData = <T, K extends string = Extract<keyof T, string>>(
    data: T[],
    initialSort: SortConfig<K> | null = null,
    customSortFns: Partial<Record<K, (a: T, b: T) => number>> = {}
) => {
    const [sortConfig, setSortConfig] = useState<SortConfig<K> | null>(initialSort);

    const sortedData = useMemo(() => {
        if (!sortConfig) return data;

        return [...data].sort((a, b) => {
            const key = sortConfig.key;

            // Custom sort function check
            if (customSortFns[key]) {
                const result = customSortFns[key]!(a, b);
                return sortConfig.direction === 'asc' ? result : -result;
            }

            let aValue: any = (a as any)[key];
            let bValue: any = (b as any)[key];

            // Normalize strings for comparison
            if (typeof aValue === 'string') aValue = aValue.toLowerCase();
            if (typeof bValue === 'string') bValue = bValue.toLowerCase();

            if (aValue === bValue) return 0;
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig, customSortFns]);

    const handleSort = (key: K) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return {
        sortConfig,
        setSortConfig,
        handleSort,
        sortedData
    };
};
