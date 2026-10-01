import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { WorkOrder, WOStatus, UserRole, PreventivePlan, Equipment, WOType } from '../../types';
import { GenericSkeleton } from '../../components/GenericSkeleton';
import { useAppStore } from '../../store/useAppStore';
import { useRestrictedItems } from '../../hooks/useFilteredData';
import { PageHeader } from '../../components/ui/PageHeader';

// Subcomponents
import { MaintenanceWorkOrders } from './components/MaintenanceWorkOrders';
import { MaintenancePreventivePlans } from './components/MaintenancePreventivePlans';
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
    initialMode?: 'create' | null;
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
        addPreventivePlan: onAddPreventivePlan,
        updatePreventivePlan: onUpdatePreventivePlan,
        deletePreventivePlan: onDeletePreventivePlan,
        updateWorkOrder: onUpdateWorkOrder,
        generateWorkOrderFromPlan,
        inventory,
        updateInventory: onUpdateInventory,
        creationMode,
        setCreationMode
    } = useAppStore();

    if (!currentUser) return <GenericSkeleton />;

    const canManageMaintenance = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SECTION_MANAGER;

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
        if (initialMode === 'create') {
            setModalMode(currentUser.role === UserRole.TECHNICIAN ? 'corrective' : 'selection');
            onModeHandled?.();
        }
    }, [initialMode, currentUser.role, onModeHandled]);

    useEffect(() => {
        if (creationMode) {
            setModalMode(currentUser.role === UserRole.TECHNICIAN ? 'corrective' : 'selection');
            setCreationMode(false);
        }
    }, [creationMode, currentUser.role, setCreationMode]);

    // --- Security Filtering ---
    const securityFilteredWorkOrders = useRestrictedItems(
        workOrders,
        currentUser,
        (wo) => [wo.section, ...(wo.collaboratingSections || [])],
        (wo, user) => wo.assignedUserId === user.id || (wo.collaborators || []).includes(user.id)
    );

    const securityFilteredPlans = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.OBSERVER_L1 || currentUser.role === UserRole.OBSERVER_L2) return preventivePlans;
        return preventivePlans.filter(plan => {
            const eq = equipment.find(e => e.id === plan.equipmentId);
            const sections = eq?.sections || [];
            return sections.some(s => currentUser.sections.includes(s));
        });
    }, [preventivePlans, currentUser, equipment]);

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
                    (viewMode !== 'plans' || canManageMaintenance) && (
                        <button
                            onClick={handleCreateClick}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition w-full sm:w-auto shadow-lg ${viewMode === 'plans'
                                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                                : viewMode === 'plannedActions'
                                    ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                                }`}
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

            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
                <button
                    onClick={() => setViewMode('workOrders')}
                    className={`px-4 py-1.5 rounded-md text-base font-medium transition-all ${viewMode === 'workOrders'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Órdenes de Trabajo
                </button>
                <button
                    onClick={() => setViewMode('plans')}
                    className={`px-4 py-1.5 rounded-md text-base font-medium transition-all ${viewMode === 'plans'
                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Planes Preventivos
                </button>
                <button
                    onClick={() => setViewMode('plannedActions')}
                    className={`px-4 py-1.5 rounded-md text-base font-medium transition-all ${viewMode === 'plannedActions'
                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Actuaciones
                </button>
            </div>

            {/* Views */}
            {viewMode === 'plans' ? (
                <MaintenancePreventivePlans
                    plans={securityFilteredPlans}
                    equipment={equipment}
                    canManage={canManageMaintenance}
                    onLaunch={(planId) => generateWorkOrderFromPlan(planId, new Date().toISOString())}
                    onEdit={(plan) => {
                        setSelectedPlanToEdit(plan);
                        setModalMode('preventive');
                    }}
                    onDelete={onDeletePreventivePlan}
                />
            ) : (
                <MaintenanceWorkOrders
                    workOrders={securityFilteredWorkOrders.filter(wo => {
                        if (viewMode === 'plannedActions') {
                            return wo.type === WOType.PLANNED;
                        } else {
                            // viewMode === 'workOrders'
                            // Show everything that is NOT a preventive plan template (which are separate entities in 'preventivePlans')
                            // Ideally, show everything. The user requested PLANNED to be visible here.
                            return true;
                        }
                    })}
                    users={users}
                    equipment={equipment}
                    onSelectWO={(id) => setSelectedWOId(id)}
                    onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                    onComplete={(wo) => setCompletingWO(wo)}
                    initialFilters={initialFilters}
                    viewMode={viewMode === 'plannedActions' ? 'plannedActions' : 'workOrders'}
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
                    onSubmit={(plan, launchNow) => {
                        if (selectedPlanToEdit) {
                            onUpdatePreventivePlan(plan);
                        } else {
                            onAddPreventivePlan(plan, launchNow);
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
                    onConfirm={async (updatedWO) => {
                        try {
                            await onUpdateWorkOrder(updatedWO);
                            setStatusActionWO(null);
                        } catch (e) {
                            toast.error('Error al actualizar estado');
                        }
                    }}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};
