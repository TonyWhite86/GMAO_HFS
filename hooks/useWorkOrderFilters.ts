import { useMemo, useState, useEffect } from 'react';
import { WorkOrder, WOStatus, WOPriority, WOType, User, Equipment } from '../types';
import { useSearchFilter } from './useSearchFilter';
import { useSortableData, SortConfig } from './useSortableData';

export type SortKey = 'title' | 'status' | 'priority' | 'equipment' | 'assigned' | 'date';

export interface FilterCriteria {
    status?: WOStatus[];
    priority?: WOPriority[];
    section?: string[];
    unassigned?: boolean;
    startDate?: string;
    endDate?: string;
    filterText?: string;
}

export const useWorkOrderFilters = (
    allWorkOrders: WorkOrder[],
    initialFilters?: FilterCriteria,
    initialViewMode: 'workOrders' | 'plannedActions' | 'all' = 'workOrders',
    users: User[] = [],
    equipment: Equipment[] = []
) => {
    // 1. Initialize useSearchFilter
    const {
        searchTerm: filterText,
        setSearchTerm: setFilterText,
        filters,
        setFilter,
        filteredData: searchableWOs
    } = useSearchFilter<WorkOrder>({
        data: allWorkOrders,
        searchFields: ['title', 'id'],
        filterConfigs: {
            viewMode: (item, mode) => {
                if (mode === 'plannedActions') return item.type === WOType.PLANNED;
                return true;
            },
            status: (item, statuses, allFilters) => {
                // If we are in plannedActions mode, we ignore status filter (per original logic)
                if (allFilters.viewMode === 'plannedActions') return true;
                return statuses.length === 0 || statuses.includes(item.status);
            },
            dateRange: (item, range) => {
                const { start, end } = range;
                if (!start && !end) return true;
                const woDate = new Date(item.scheduledDate || item.createdAt).getTime();
                if (start && woDate < new Date(start).getTime()) return false;
                if (end) {
                    const e = new Date(end);
                    e.setHours(23, 59, 59, 999);
                    return woDate <= e.getTime();
                }
                return true;
            },
            unassigned: (item, value) => {
                if (!value) return true;
                // If filter is true, show only if NO assiged user
                return !item.assignedUserId;
            }
        }
    });

    // 2. Initialize useSortableData
    const priorityWeights = { [WOPriority.CRITICAL]: 4, [WOPriority.HIGH]: 3, [WOPriority.MEDIUM]: 2, [WOPriority.LOW]: 1 };

    const customSortFns = useMemo(() => ({
        priority: (a: WorkOrder, b: WorkOrder) => priorityWeights[b.priority] - priorityWeights[a.priority],
        equipment: (a: WorkOrder, b: WorkOrder) => {
            const aName = equipment.find(e => e.id === a.equipmentId)?.name || '';
            const bName = equipment.find(e => e.id === b.equipmentId)?.name || '';
            return aName.localeCompare(bName);
        },
        assigned: (a: WorkOrder, b: WorkOrder) => {
            const aName = users.find(u => u.id === a.assignedUserId)?.name || a.assignedGroupId || 'zzz';
            const bName = users.find(u => u.id === b.assignedUserId)?.name || b.assignedGroupId || 'zzz';
            return aName.localeCompare(bName);
        },
        date: (a: WorkOrder, b: WorkOrder) => {
            const aDate = new Date(a.scheduledDate || a.createdAt).getTime();
            const bDate = new Date(b.scheduledDate || b.createdAt).getTime();
            return aDate - bDate;
        }
    }), [equipment, users]);

    const {
        sortConfig,
        setSortConfig,
        handleSort,
        sortedData: filteredWOs
    } = useSortableData<WorkOrder, SortKey>(searchableWOs, null, customSortFns);

    // 3. Keep local state for convenience and backward compatibility if needed, 
    // but sync them with the generic filters
    const viewMode = (filters.viewMode as string) || initialViewMode;
    const activeStatuses = (filters.status as WOStatus[]) || (initialFilters?.status || [WOStatus.PENDING, WOStatus.SCHEDULED, WOStatus.IN_PROGRESS]);
    const selectedPriorities = (filters.priority as WOPriority[]) || (initialFilters?.priority || []);
    const selectedSections = (filters.section as string[]) || (initialFilters?.section || []);
    const showUnassigned = !!filters.unassigned;
    const startDate = (filters.dateRange?.start as string) || '';
    const endDate = (filters.dateRange?.end as string) || '';

    // Effects for initial setup and external changes
    useEffect(() => {
        setFilter('viewMode', initialViewMode);
    }, [initialViewMode]);

    useEffect(() => {
        if (initialFilters) {
            setFilter('status', initialFilters.status || [WOStatus.PENDING, WOStatus.SCHEDULED, WOStatus.IN_PROGRESS]);
            if (initialFilters.priority) setFilter('priority', initialFilters.priority);
            if (initialFilters.section) setFilter('section', initialFilters.section);
            if (initialFilters.unassigned !== undefined) setFilter('unassigned', initialFilters.unassigned);
            if (initialFilters.startDate || initialFilters.endDate) {
                setFilter('dateRange', { start: initialFilters.startDate, end: initialFilters.endDate });
            }
            if (initialFilters.filterText !== undefined) setFilterText(initialFilters.filterText);
        } else {
            setFilter('status', [WOStatus.PENDING, WOStatus.SCHEDULED, WOStatus.IN_PROGRESS]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(initialFilters)]);

    // Actions for compatibility
    const setViewMode = (mode: string) => setFilter('viewMode', mode);
    const setActiveStatuses = (val: WOStatus[]) => setFilter('status', val);
    const toggleStatusFilter = (status: WOStatus) => {
        const current = (filters.status as WOStatus[]) || [];
        setFilter('status', current.includes(status) ? current.filter(s => s !== status) : [...current, status]);
    };
    const setSelectedPriorities = (val: WOPriority[]) => setFilter('priority', val);
    const togglePriorityFilter = (priority: WOPriority) => {
        const current = (filters.priority as WOPriority[]) || [];
        setFilter('priority', current.includes(priority) ? current.filter(p => p !== priority) : [...current, priority]);
    };
    const setSelectedSections = (val: string[]) => setFilter('section', val);
    const toggleSectionFilter = (sec: string) => {
        const current = (filters.section as string[]) || [];
        setFilter('section', current.includes(sec) ? current.filter(s => s !== sec) : [...current, sec]);
    };
    const setShowUnassigned = (val: boolean) => setFilter('unassigned', val);
    const setStartDate = (val: string) => setFilter('dateRange', { ...filters.dateRange, start: val });
    const setEndDate = (val: string) => setFilter('dateRange', { ...filters.dateRange, end: val });

    return {
        viewMode, setViewMode,
        filterText, setFilterText,
        activeStatuses, setActiveStatuses, toggleStatusFilter,
        selectedPriorities, setSelectedPriorities, togglePriorityFilter,
        selectedSections, setSelectedSections, toggleSectionFilter,
        showUnassigned, setShowUnassigned,
        startDate, setStartDate,
        endDate, setEndDate,
        sortConfig, setSortConfig, handleSort,
        filteredWOs
    };
};

