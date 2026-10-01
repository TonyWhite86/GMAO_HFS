import { useState, useMemo, useEffect } from 'react';
import type { DragEvent } from 'react';
import { WorkOrder, User, WOStatus, UserRole } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useRestrictedItems } from '../../hooks/useFilteredData';
import { useWorkOrderFilters } from '../../hooks/useWorkOrderFilters';
import { usePermissions } from '../../hooks/usePermissions';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { getDaysToShow, navigateDate, formatHeaderLabel } from '../../utils/dateUtils';

export const useScheduler = () => {
    const {
        workOrders,
        users,
        equipment,
        currentUser,
        sections,
        preventivePlans,
        inventory,
        updateWorkOrder: onUpdateWorkOrder,
        addWorkOrder: onAddWorkOrder,
        updateInventory: onUpdateInventory
    } = useAppStore();

    const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showSunday, setShowSunday] = useState(false);
    const [draggedWO, setDraggedWO] = useState<WorkOrder | null>(null);
    const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
    const isMobile = useIsMobile();

    // Quick Create State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ userId: string, date: Date } | null>(null);
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');
    const [filterPriority, setFilterPriority] = useState<string>('');

    const perms = usePermissions(currentUser);
    const canViewGrid = perms.canViewSchedulerGrid;

    const [activeTab, setActiveTab] = useState<'programacion' | 'parte'>(canViewGrid ? 'programacion' : 'parte');

    // Subtask Assignment Modal State
    const [isAssignSubtasksModalOpen, setIsAssignSubtasksModalOpen] = useState(false);
    const [pendingAssignment, setPendingAssignment] = useState<{ wo: WorkOrder, userId: string, date: Date } | null>(null);
    const [selectedSubtasksToAssign, setSelectedSubtasksToAssign] = useState<string[]>([]);
    const [assignMain, setAssignMain] = useState(true);

    // On mobile the grid is not usable: force the work log (Parte) tab and the day view.
    useEffect(() => {
        if (isMobile && activeTab === 'programacion') {
            setActiveTab('parte');
        }
    }, [isMobile, activeTab]);

    useEffect(() => {
        if (isMobile) setViewMode('day');
    }, [isMobile]);

    // 1. Filter Users by Role (Base Pool)
    const baseTechnicians = users.filter(u => u.role === UserRole.TECHNICIAN || u.role === UserRole.SECTION_MANAGER);

    // 2. Filter Users by Security (Section Visibility)
    const securityFilteredTechnicians = useRestrictedItems(
        baseTechnicians,
        currentUser,
        (u) => u.role === UserRole.ADMIN ? sections.map(s => s.name) : u.sections
    );

    // 3. Filter Users by UI Selection
    const technicians = securityFilteredTechnicians.filter(u => {
        if (u.role === UserRole.ADMIN) return true; // Admins always show
        if (selectedSection) return u.sections.includes(selectedSection);
        return true;
    });

    // 4. Filter Work Orders by Security
    const visibleWorkOrders = useRestrictedItems(
        workOrders,
        currentUser,
        (wo) => [wo.section, ...(wo.collaboratingSections || [])],
        (wo, user) => wo.assignedUserId === user.id || (wo.collaborators || []).includes(user.id)
    );

    // 4b. Apply additional filters (type, priority)
    const filteredWorkOrders = visibleWorkOrders.filter(wo => {
        if (filterType && wo.type !== filterType) return false;
        if (filterPriority && wo.priority !== filterPriority) return false;
        return true;
    });

    // 4. Filter Work Orders using the new hook
    const defaultFilters = useMemo(() => ({
        unassigned: true,
        status: [WOStatus.PENDING, WOStatus.SCHEDULED, WOStatus.IN_PROGRESS],
        section: selectedSection ? [selectedSection] : []
    }), [selectedSection]);

    const {
        filterText: sidebarSearchTerm,
        setFilterText: setSidebarSearchTerm,
        filteredWOs: unassignedWOs
    } = useWorkOrderFilters(
        filteredWorkOrders,
        defaultFilters,
        'workOrders',
        users,
        equipment
    );

    const daysToShow = useMemo(
        () => getDaysToShow(viewMode, currentDate, showSunday),
        [viewMode, currentDate, showSunday]
    );

    const headerLabel = formatHeaderLabel(viewMode, currentDate, daysToShow);

    const handleNavigate = (direction: 'prev' | 'next') => {
        setCurrentDate(prev => navigateDate(prev, viewMode, direction));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const handleAssign = (wo: WorkOrder, userId: string, targetDate: Date) => {
        onUpdateWorkOrder({
            ...wo,
            assignedUserId: userId,
            status: WOStatus.SCHEDULED,
            scheduledDate: targetDate.toISOString()
        });
    };

    const handleUnassign = (wo: WorkOrder, userIdToUnassign?: string) => {
        let updatedWO = { ...wo };
        let hasRemainingAssignees = false;

        if (userIdToUnassign) {
            // 1. Remove from Main Assignee
            if (updatedWO.assignedUserId === userIdToUnassign) {
                updatedWO.assignedUserId = undefined;
            }

            // 2. Remove from Subtasks
            if (updatedWO.subtasks && updatedWO.subtasks.length > 0) {
                updatedWO.subtasks = updatedWO.subtasks.map(t => ({
                    ...t,
                    assignedUserIds: t.assignedUserIds?.filter(id => id !== userIdToUnassign) || []
                }));
            }

            // 3. Remove from Collaborators
            if (updatedWO.collaborators) {
                updatedWO.collaborators = updatedWO.collaborators.filter(id => id !== userIdToUnassign);
            }

            // Check if anyone else is left
            const hasMain = !!updatedWO.assignedUserId;
            const hasSub = updatedWO.subtasks?.some(t => t.assignedUserIds && t.assignedUserIds.length > 0);
            const hasCollab = updatedWO.collaborators && updatedWO.collaborators.length > 0;

            hasRemainingAssignees = hasMain || hasSub || hasCollab;
        }

        // If completely empty (or naive unassign was called), reset status
        if (!userIdToUnassign || !hasRemainingAssignees) {
            updatedWO.assignedUserId = undefined;
            updatedWO.status = WOStatus.PENDING;
            updatedWO.scheduledDate = undefined; // Move back to unassigned pool
            if (!userIdToUnassign) {
                updatedWO.subtasks = updatedWO.subtasks?.map(t => ({ ...t, assignedUserIds: [] }));
                updatedWO.collaborators = [];
            }
        }

        onUpdateWorkOrder(updatedWO);
    };

    // Drag and Drop Handlers
    const handleDragStart = (e: DragEvent, wo: WorkOrder) => {
        setDraggedWO(wo);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: DragEvent, userId: string, date: Date) => {
        e.preventDefault();
        if (draggedWO) {
            // New Restriction Check
            const targetUser = users.find(u => u.id === userId);
            const isTargetAdmin = targetUser?.role === UserRole.ADMIN;
            const allowedSections = [draggedWO.section, ...(draggedWO.collaboratingSections || [])];
            const isAllowed = isTargetAdmin || targetUser?.sections.some(s => allowedSections.includes(s));

            if (!isAllowed) {
                alert(`No se puede asignar a ${targetUser?.name}. El técnico debe pertenecer a la sección '${draggedWO.section}' o a sus secciones colaboradoras.`);
                setDraggedWO(null);
                return;
            }

            if (draggedWO.subtasks && draggedWO.subtasks.length > 0) {
                setPendingAssignment({ wo: draggedWO, userId, date });
                setSelectedSubtasksToAssign([]); // Start empty, user selects
                setAssignMain(true);
                setIsAssignSubtasksModalOpen(true);
            } else {
                handleAssign(draggedWO, userId, date);
            }
            setDraggedWO(null);
        }
    };

    const handleConfirmSubtaskAssignment = () => {
        if (!pendingAssignment) return;

        const { wo, userId, date } = pendingAssignment;

        // Update Subtasks
        const updatedSubtasks = wo.subtasks?.map(t => {
            if (selectedSubtasksToAssign.includes(t.id)) {
                const currentIds = t.assignedUserIds || [];
                if (!currentIds.includes(userId)) {
                    return { ...t, assignedUserIds: [...currentIds, userId] };
                }
            }
            return t;
        }) || [];

        const updatedWO = {
            ...wo,
            assignedUserId: assignMain ? userId : wo.assignedUserId, // Only update main if checked
            status: WOStatus.SCHEDULED,
            scheduledDate: date.toISOString(),
            subtasks: updatedSubtasks
        };

        onUpdateWorkOrder(updatedWO);
        setIsAssignSubtasksModalOpen(false);
        setPendingAssignment(null);
    };

    // Quick Create Handlers
    const handleOpenCreateModal = (userId: string, date: Date) => {
        setSelectedSlot({ userId, date });
        setIsCreateModalOpen(true);
    };

    const handleCreateSubmit = (wo: WorkOrder) => {
        // If created from specific slot, force assignment
        if (selectedSlot) {
            const scheduledWO = {
                ...wo,
                assignedUserId: selectedSlot.userId,
                status: WOStatus.SCHEDULED,
                scheduledDate: selectedSlot.date.toISOString()
            };
            onAddWorkOrder(scheduledWO);
        } else {
            onAddWorkOrder(wo);
        }
        setIsCreateModalOpen(false);
        setSelectedSlot(null);
    };

    const handleCloseCreateModal = () => {
        setIsCreateModalOpen(false);
        setSelectedSlot(null);
    };

    const handleSelectWO = (wo: WorkOrder | null) => {
        setSelectedWO(wo);
    };

    const handleUpdateSelectedWO = (updatedWO: WorkOrder, shouldClose?: boolean) => {
        onUpdateWorkOrder(updatedWO);
        if (shouldClose !== false) {
            setSelectedWO(null);
        }
    };

    return {
        // Store data
        currentUser,
        workOrders,
        users,
        equipment,
        sections,
        preventivePlans,
        inventory,
        onAddWorkOrder,
        onUpdateInventory,
        // State
        viewMode,
        setViewMode,
        currentDate,
        showSunday,
        setShowSunday,
        selectedWO,
        isMobile,
        canViewGrid,
        activeTab,
        setActiveTab,
        selectedSection,
        setSelectedSection,
        filterType,
        setFilterType,
        filterPriority,
        setFilterPriority,
        isCreateModalOpen,
        isAssignSubtasksModalOpen,
        setIsAssignSubtasksModalOpen,
        pendingAssignment,
        selectedSubtasksToAssign,
        setSelectedSubtasksToAssign,
        assignMain,
        setAssignMain,
        // Derived
        technicians,
        unassignedWOs,
        sidebarSearchTerm,
        setSidebarSearchTerm,
        daysToShow,
        headerLabel,
        // Handlers
        handleNavigate,
        handleToday,
        handleAssign,
        handleUnassign,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleConfirmSubtaskAssignment,
        handleOpenCreateModal,
        handleCreateSubmit,
        handleCloseCreateModal,
        handleSelectWO,
        handleUpdateSelectedWO
    };
};

export type SchedulerStore = ReturnType<typeof useScheduler>;
