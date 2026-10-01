import { useMemo } from 'react';
import { User, UserRole, Equipment, WorkOrder } from '../types';
import { useAppStore } from '../store/useAppStore';

/**
 * Generic hook to filter a list of items based on user role and section.
 * @param items The list of items to filter.
 * @param currentUser The current logged-in user.
 * @param sectionExtractor A function to extract the section(s) from an item. Defaults to reading 'section' property.
 */
export const useRestrictedItems = <T>(
    items: T[],
    currentUser: User | null,
    sectionExtractor: (item: T) => string | string[] = (item: any) => item.section,
    explicitAccessCheck?: (item: T, user: User) => boolean
) => {
    return useMemo(() => {
        // Defensive: Check for null items array
        if (!items || !Array.isArray(items)) return [];

        // Defensive: Check for null user
        if (!currentUser) return [];

        // Admin and Observers see everything
        if (
            currentUser.role === UserRole.ADMIN ||
            currentUser.role === UserRole.OBSERVER_L1 ||
            currentUser.role === UserRole.OBSERVER_L2
        ) return items;

        // Defensive: Check if user has sections defined
        if (!currentUser.sections || !Array.isArray(currentUser.sections)) {
            console.warn('User has no sections defined or invalid sections array:', currentUser);
            return [];
        }

        return items.filter(item => {
            if (!item) return false;

            // 1. Check Explicit Access (Assignment)
            if (explicitAccessCheck && explicitAccessCheck(item, currentUser)) {
                return true;
            }

            let sections: string | string[] = [];
            try {
                sections = sectionExtractor(item);
            } catch (e) {
                console.warn('Error extracting section from item:', item, e);
                return false;
            }

            const itemSections = Array.isArray(sections) ? sections : [sections];

            // If item has no sections, is it global? 
            // Assumption: If it has 'undefined' section, it might be visible to all OR hidden.
            // For safety, let's say only items with matching sections are shown.
            // Filter out undefined/null values from itemSections
            const validItemSections = itemSections.filter(s => typeof s === 'string');

            // Global items visible to everyone
            if (validItemSections.includes('Global')) return true;

            return validItemSections.some(s => currentUser.sections.includes(s));
        });
    }, [items, currentUser]);
};

/**
 * specialized hook for filtering Equipment Tree.
 * Handles the logic where if a parent is hidden but child is visible, 
 * the child is promoted to root level (Orphan Promotion).
 */

export const useRestrictedEquipment = (
    equipmentList: Equipment[],
    currentUser: User | null
) => {
    // Memoized restricted list
    return useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === UserRole.ADMIN) return equipmentList;

        const userSections = Array.isArray(currentUser.sections) ? currentUser.sections : [];

        // 0. Bypass for users with inventory access: They need to see everything to link parts
        const perms = useAppStore.getState().userPermissions;
        const invLevel = perms.find(p => p.userId === currentUser.id && p.module === 'inventory')?.level ?? 'sin_acceso';
        const canViewAll = invLevel === 'parcial' || invLevel === 'total';

        if (canViewAll) return equipmentList;

        // 1. Filter equipment by section
        const visibleEquipment = equipmentList.filter(eq => {
            const eqSections = Array.isArray(eq.sections) ? eq.sections : [];
            return eqSections.some(s => userSections.includes(s));
        });

        // 2. Perform Orphan Promotion
        // If an equipment is visible but its parent is not, promote it to root (set parentId to null)
        const visibleIds = new Set(visibleEquipment.map(e => e.id));
        // console.log('Visible IDs after initial filter:', Array.from(visibleIds)); // Debug log

        return visibleEquipment.map(eq => {
            if (eq.parentId && !visibleIds.has(eq.parentId)) {
                // console.log(`Promoting equipment ${eq.id} (parent ${eq.parentId} not visible).`); // Debug log
                return { ...eq, parentId: null };
            }
            return eq;
        });
    }, [equipmentList, currentUser]);
};
