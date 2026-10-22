import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { WorkOrder, WOStatus, UserRole, PreventivePlan, Equipment, WOType } from '../../types';
import { GenericSkeleton } from '../../components/GenericSkeleton';
import { useAppStore } from '../../store/useAppStore';
import { useRestrictedItems } from '../../hooks/useFilteredData';
import { usePermissions } from '../../hooks/usePermissions';
import { PageHeader } from '../../components/ui/PageHeader';

// Subcomponents
import { MaintenanceWorkOrders } from './components/MaintenanceWorkOrders';
import { MaintenancePreventivePlans } from './components/MaintenancePreventivePlans';
import { PlannedActionsView } from './components/PlannedActionsView';
import { OrderTypeSelectionModal } from './components/OrderTypeSelectionModal';
import { CreatePreventiveModal } from './components/CreatePreventiveModal';

// Shared Modals
import { CreateWorkOrderModal } from '../../components/CreateWorkOrderModal';
import { CreatePlannedModal } from '../../components/CreatePlannedModal';
import { WorkOrderDetailModal } from '../../components/WorkOrderDetailModal';
import { QuickCompleteModal } from '../../components/workOrder/QuickCompleteModal';
import { QuickStatusModal } from '../../components/workOrder/QuickStatusModal';

type ModalMode = 'none' | 'selection' | 'corrective' | 'preventive' | 'planned';
type ViewMode = 'workOrders' | 'plans' | 'plannedActions';

export interface MaintenanceProps {
    initialMode?: 'create' | 'preventive' | 'planned' | null;
    initialFilters?: {
        status?: WOStatus[];
        unassigned?: boolean;
        priority?: any[];
        section?: string[];
    } | null;
    onModeHandled?: () => void;
}

export const Maintenance: React.FC<MaintenanceProps> = ({
    initialMode,
    initialFilters,
    onModeHandled
}) => {
    const {
        workOrders,
        preventivePlans,
        equipment,
        users,
        currentUser,
        sections,
        addWorkOrder: onAddWorkOrder,
        updateWorkOrder: onUpdateWorkOrder,
        addPreventivePlan: onAddPreventivePlan,
        updatePreventivePlan: onUpdatePreventivePlan,
        deletePreventivePlan: onDeletePreventivePlan,
        generateWorkOrderFromPlan,
        inventory,
        updateInventory: onUpdateInventory,
    } = useAppStore();

    if (!currentUser) return <GenericSkeleton />;

    const canManageMaintenance = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SECTION_MANAGER;
    const { canViewActuaciones, canCreateActuaciones } = usePermissions(currentUser);

    // View State
    const [viewMode, setViewMode] = useState<ViewMode>('workOrders');

    // Modal State
    const [modalMode, setModalMode] = useState<ModalMode>('none');
    const [selectedWOId, setSelectedWOId] = useState<string | null>(null);
    const [completingWO, setCompletingWO] = useState<WorkOrder | null>(null);
    const [statusActionWO, setStatusActionWO] = useState<{ wo: WorkOrder; nextStatus: WOStatus } | null>(null);
    const [selectedPlanToEdit, setSelectedPlanToEdit] = useState<PreventivePlan | undefined>(undefined);

    const selectedWO = workOrders.find(wo => wo.id === selectedWOId) || null;

    // --- Handling Initial Props & Store Signals ---
    useEffect(() => {
        if (!initialMode) return;
        if (initialMode === 'create') {
            setModalMode(currentUser.role === UserRole.TECHNICIAN ? 'corrective' : 'selection');
        } else if (initialMode === 'preventive') {
            setModalMode('preventive');
        } else if (initialMode === 'planned') {
            setModalMode('planned');
        }
        onModeHandled?.();
    }, [initialMode, currentUser.role, onModeHandled]);

    useEffect(() => {
        if (viewMode === 'plannedActions' && !canViewActuaciones) {
            setViewMode('workOrders');
        }
    }, [viewMode, canViewActuaciones]);

    // --- Security Filtering ---
    const securityFilteredWorkOrders = useRestrictedItems(
        workOrders,
        currentUser,
        (wo) => [wo.section, ...(wo.collaboratingSections || [])],
        (wo, user) => wo.assignedUserId === user.id || (wo.collaborators || []).includes(user.id)
    );

    // Audiencia del plan: sección principal/colaboradora, responsable o
    // colaborador (espejo de plan_visible_to_me en BD). Además, Admin/comodín
    // ven todo y los observadores solo lo de su sección.
    const securityFilteredPlans = useRestrictedItems(
        preventivePlans,
        currentUser,
        (plan) => {
            const targetSections = (plan.targets || []).flatMap(t => {
                const eq = equipment.find(e => e.id === t.equipmentId);
                return eq?.sections || [];
            });
            return [plan.section || '', ...(plan.collaboratingSections || []), ...targetSections];
        },
        (plan, user) => plan.assignedUserId === user.id || (plan.collaborators || []).includes(user.id)
    );

    const openWoCount = securityFilteredWorkOrders.filter(wo => wo.status !== WOStatus.COMPLETED).length;
    const plannedCount = securityFilteredWorkOrders.filter(wo => wo.type === WOType.PLANNED).length;

    const handleCreateClick = () => {
        if (viewMode === 'plans') {
            setModalMode('preventive');
            setSelectedPlanToEdit(undefined);
        } else if (viewMode === 'plannedActions') {
            setModalMode('planned');
        } else {
            if (currentUser.role === UserRole.TECHNICIAN) {
                setModalMode('corrective');
            } else {
                setModalMode('selection');
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <PageHeader
                title="Gestión de Mantenimiento"
                actions={
                    (viewMode !== 'plans' || canManageMaintenance)
                    && (viewMode !== 'plannedActions' || canCreateActuaciones)
                    && (
                        <button
                            onClick={handleCreateClick}
                            className="btn btn-primary w-full sm:w-auto justify-center px-4 py-2.5 !text-[13px] shadow-lg"
                        >
                            <Plus size={18} />
                            <span>
                                {viewMode === 'plans' ? 'Nuevo Plan' :
                                    viewMode === 'plannedActions' ? 'Nueva Actuación' :
                                        'Nueva Orden'}
                            </span>
                        </button>
                    )
                }
            />

            <div className="tabs w-fit">
                <button
                    onClick={() => setViewMode('workOrders')}
                    className={`tab ${viewMode === 'workOrders' ? 'active' : ''}`}
                >
                    Órdenes de Trabajo
                    <span className="bdg bdg-gray ml-1.5">{openWoCount}</span>
                </button>
                <button
                    onClick={() => setViewMode('plans')}
                    className={`tab ${viewMode === 'plans' ? 'active' : ''}`}
                >
                    Planes Preventivos
                    <span className="bdg bdg-gray ml-1.5">{securityFilteredPlans.length}</span>
                </button>
                {canViewActuaciones && (
                    <button
                        onClick={() => setViewMode('plannedActions')}
                        className={`tab ${viewMode === 'plannedActions' ? 'active' : ''}`}
                    >
                        Actuaciones
                        <span className="bdg bdg-gray ml-1.5">{plannedCount}</span>
                    </button>
                )}
            </div>

            {/* Views */}
            {viewMode === 'plans' ? (
                <MaintenancePreventivePlans
                    plans={securityFilteredPlans}
                    equipment={equipment}
                    canManage={canManageMaintenance}
                    onLaunch={(planId) => generateWorkOrderFromPlan(planId)}
                    onEdit={(plan) => {
                        setSelectedPlanToEdit(plan);
                        setModalMode('preventive');
                    }}
                    onDelete={onDeletePreventivePlan}
                />
            ) : viewMode === 'plannedActions' ? (
                <PlannedActionsView
                    workOrders={securityFilteredWorkOrders.filter(wo => wo.type === WOType.PLANNED)}
                    users={users}
                    equipment={equipment}
                    onSelectWO={(id) => setSelectedWOId(id)}
                    onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                    onComplete={(wo) => setCompletingWO(wo)}
                />
            ) : (
                <MaintenanceWorkOrders
                    workOrders={securityFilteredWorkOrders}
                    users={users}
                    equipment={equipment}
                    onSelectWO={(id) => setSelectedWOId(id)}
                    onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                    onComplete={(wo) => setCompletingWO(wo)}
                    onUpdateWO={(wo, updates) => onUpdateWorkOrder({ ...wo, ...updates })}
                    initialFilters={initialFilters}
                    viewMode="workOrders"
                />
            )}

            {/* Modals */}
            {modalMode === 'selection' && (
                <OrderTypeSelectionModal
                    onClose={() => setModalMode('none')}
                    onSelectCorrective={() => setModalMode('corrective')}
                    onSelectPreventive={() => {
                        setModalMode('preventive');
                        setSelectedPlanToEdit(undefined);
                    }}
                    onSelectPlanned={() => setModalMode('planned')}
                />
            )}

            {modalMode === 'corrective' && (
                <CreateWorkOrderModal
                    onClose={() => setModalMode('none')}
                    onSubmit={onAddWorkOrder}
                    equipment={equipment}
                    users={users}
                    currentUser={currentUser}
                    existingWorkOrders={workOrders}
                    sections={sections}
                />
            )}

            {modalMode === 'planned' && (
                <CreatePlannedModal
                    onClose={() => setModalMode('none')}
                    onSubmit={(wo) => {
                        onAddWorkOrder(wo);
                        setModalMode('none');
                    }}
                    equipment={equipment}
                    users={users}
                    currentUser={currentUser}
                    sections={sections}
                    existingWorkOrders={workOrders}
                />
            )}

            {modalMode === 'preventive' && (
                <CreatePreventiveModal
                    onClose={() => {
                        setModalMode('none');
                        setSelectedPlanToEdit(undefined);
                    }}
                    onSubmit={(plan, launchNow, targets) => {
                        if (selectedPlanToEdit) {
                            onUpdatePreventivePlan(plan, targets);
                        } else {
                            onAddPreventivePlan(plan, targets, launchNow);
                        }
                        setModalMode('none');
                        setSelectedPlanToEdit(undefined);
                    }}
                    equipment={equipment}
                    users={users}
                    currentUser={currentUser}
                    editingPlan={selectedPlanToEdit}
                    readOnly={currentUser.role === UserRole.TECHNICIAN}
                    sections={sections}
                />
            )}

            {selectedWO && (
                <WorkOrderDetailModal
                    workOrder={selectedWO}
                    preventivePlans={preventivePlans}
                    currentUser={currentUser}
                    users={users}
                    equipment={equipment}
                    existingWorkOrders={workOrders}
                    sections={sections}
                    inventory={inventory}
                    onUpdateInventory={onUpdateInventory}
                    onClose={() => setSelectedWOId(null)}
                    onUpdate={(updatedWO, shouldClose) => {
                        onUpdateWorkOrder(updatedWO);
                        if (shouldClose !== false) {
                            setSelectedWOId(null);
                        } else {
                            // Keep open but update data
                        }
                    }}
                    onAddWorkOrder={onAddWorkOrder}
                />
            )}

            {completingWO && (
                <QuickCompleteModal
                    workOrder={completingWO}
                    onClose={() => setCompletingWO(null)}
                    onConfirm={async (updatedWO) => {
                        try {
                            await onUpdateWorkOrder(updatedWO);
                            setCompletingWO(null);
                        } catch (e) {
                            toast.error('Error al cerrar la orden');
                        }
                    }}
                    inventory={inventory}
                    currentUser={currentUser}
                />
            )}

            {statusActionWO && (
                <QuickStatusModal
                    workOrder={statusActionWO.wo}
                    nextStatus={statusActionWO.nextStatus}
                    onClose={() => setStatusActionWO(null)}
                    onConfirm={() => {
                        // El cambio de estado ya lo hizo transition_work_order (RPC):
                        // aquí no se vuelve a escribir la OT.
                        setStatusActionWO(null);
                    }}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};
