import { useState, useMemo, useEffect } from 'react';
import type { DragEvent } from 'react';
import { WorkOrder, User, WOStatus, UserRole } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useRestrictedItems } from '../../hooks/useFilteredData';
import { canBeAssignedToWO } from '../../utils/incidentVisibility';
import { useWorkOrderFilters } from '../../hooks/useWorkOrderFilters';
import { usePermissions } from '../../hooks/usePermissions';
import { workOrderService } from '../../services/workOrderService';
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
        patchWorkOrderLocal,
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

    // Mover el inicio desplaza el fin el mismo delta (la RPC hace lo mismo):
    // un trabajo multi-día conserva su duración al arrastrarlo.
    const shiftEndDate = (wo: WorkOrder, newStartISO: string): string | null | undefined => {
        if (!wo.scheduledDate || !wo.scheduledEndDate) return wo.scheduledEndDate;
        const delta = new Date(newStartISO).getTime() - new Date(wo.scheduledDate).getTime();
        return new Date(new Date(wo.scheduledEndDate).getTime() + delta).toISOString();
    };

    const handleAssign = async (wo: WorkOrder, userId: string, targetDate: Date) => {
        const scheduled = targetDate.toISOString();
        // La RPC es la autoridad: valida que el técnico pertenezca a la sección
        // (o sea Admin), excluye observadores, sella status/scheduled y escribe
        // el comentario de sistema. Sólo si sale bien actualizamos el store, y lo
        // hacemos con un parche LOCAL: volver a llamar a workOrderService.update
        // reescribiría todos los metadatos del cliente y podía pisar un cambio
        // concurrente (lost update).
        try {
            await workOrderService.assign(wo.id, userId, scheduled);
        } catch (err) {
            console.error('Error asignando la OT:', err);
            return;
        }
        patchWorkOrderLocal(wo.id, {
            assignedUserId: userId,
            status: WOStatus.SCHEDULED,
            scheduledDate: scheduled,
            scheduledEndDate: shiftEndDate(wo, scheduled)
        });
    };

    const handleUnassign = async (wo: WorkOrder, userIdToUnassign?: string) => {
        // La RPC quita al usuario de responsable, subtareas y colaboradores; si
        // no queda nadie, devuelve la OT a Pendiente y le quita la fecha.
        try {
            await workOrderService.unassign(wo.id, userIdToUnassign ?? null);
        } catch (err) {
            console.error('Error desasignando la OT:', err);
            return;
        }

        const subtasks = (wo.subtasks || []).map(t => userIdToUnassign
            ? { ...t, assignedUserIds: (t.assignedUserIds || []).filter(id => id !== userIdToUnassign) }
            : { ...t, assignedUserIds: [] }
        );
        const collaborators = userIdToUnassign
            ? (wo.collaborators || []).filter(id => id !== userIdToUnassign)
            : [];
        const assignedUserId = (userIdToUnassign && wo.assignedUserId !== userIdToUnassign)
            ? wo.assignedUserId
            : undefined;

        const hasRemaining = !!assignedUserId
            || subtasks.some(t => (t.assignedUserIds || []).length > 0)
            || collaborators.length > 0;

        patchWorkOrderLocal(wo.id, {
            assignedUserId,
            subtasks,
            collaborators,
            ...(hasRemaining ? {} : { status: WOStatus.PENDING, scheduledDate: undefined, scheduledEndDate: null })
        });
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
            // Mismo criterio que assign_work_order en BD (helper compartido)
            const targetUser = users.find(u => u.id === userId);
            const isAllowed = canBeAssignedToWO(
                targetUser,
                draggedWO.section,
                draggedWO.collaboratingSections || [],
                sections
            );

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

    const handleConfirmSubtaskAssignment = async () => {
        if (!pendingAssignment) return;

        const { wo, userId, date } = pendingAssignment;
        const scheduled = date.toISOString();

        // La RPC recibe las subtareas a asignar y si se pone como responsable
        // principal: valida sección y observadores y registra el evento.
        try {
            await workOrderService.assign(
                wo.id, userId, scheduled,
                selectedSubtasksToAssign.length > 0 ? selectedSubtasksToAssign : null,
                assignMain
            );
        } catch (err) {
            console.error('Error asignando la OT:', err);
            return;
        }

        const subtasks = (wo.subtasks || []).map(t =>
            selectedSubtasksToAssign.includes(t.id)
                ? { ...t, assignedUserIds: Array.from(new Set([...(t.assignedUserIds || []), userId])) }
                : t
        );

        patchWorkOrderLocal(wo.id, {
            assignedUserId: assignMain ? userId : wo.assignedUserId,
            status: WOStatus.SCHEDULED,
            scheduledDate: scheduled,
            scheduledEndDate: shiftEndDate(wo, scheduled),
            subtasks
        });

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
