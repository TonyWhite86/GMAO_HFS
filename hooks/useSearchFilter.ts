import { useState, useMemo } from 'react';
import { normalizeForSearch } from '../utils/searchUtils';

/**
 * Generic hook for searching and filtering a list of items.
 * @param data Array of items to filter.
 * @param searchFields Array of keys in T that should be searchable via text.
 * @param filterConfigs Optional dictionary of filter functions.
 */
export interface UseSearchFilterProps<T> {
    data: T[];
    searchFields: (keyof T)[];
    filterConfigs?: Record<string, (item: T, value: any, context: Record<string, any>) => boolean>;
}

export const useSearchFilter = <T>({
    data,
    searchFields,
    filterConfigs = {}
}: UseSearchFilterProps<T>) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<string, any>>({});

    const filteredData = useMemo(() => {
        return data.filter(item => {
            // 1. Text Search Check
            if (searchTerm) {
                const normalizedTerm = normalizeForSearch(searchTerm);
                const matchesSearch = searchFields.some(field => {
                    const val = item[field];
                    if (val === null || val === undefined) return false;
                    return normalizeForSearch(String(val)).includes(normalizedTerm);
                });
                if (!matchesSearch) return false;
            }

            // 2. Custom Property Filters Check
            for (const [key, filterValue] of Object.entries(filters)) {
                if (filterValue === undefined || filterValue === null || filterValue === 'ALL') {
                    continue;
                }

                const filterFn = filterConfigs[key];
                if (filterFn) {
                    if (!filterFn(item, filterValue, filters)) return false;
                } else if (Array.isArray(filterValue)) {
                    // Array inclusion check
                    const itemValue = item[key as keyof T];
                    if (filterValue.length > 0 && !filterValue.includes(itemValue)) return false;
                } else {
                    // Default equality check for property keys
                    if (item[key as keyof T] !== filterValue) return false;
                }
            }

            return true;
        });
    }, [data, searchTerm, filters, searchFields, filterConfigs]);

    const setFilter = (key: string, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const clearFilters = () => {
        setFilters({});
        setSearchTerm('');
    };

    return {
        searchTerm,
        setSearchTerm,
        filters,
        setFilter,
        clearFilters,
        filteredData
    };
};
