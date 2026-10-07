import React from 'react';
import { UserRole } from '../../types';
import { GenericSkeleton } from '../../components/GenericSkeleton';
import { CreateWorkOrderModal } from '../../components/CreateWorkOrderModal';
import { WorkOrderDetailModal } from '../../components/WorkOrderDetailModal';
import { WorkLogGantt } from '../../components/scheduler/WorkLogGantt';
import { useScheduler } from './useScheduler';
import { SchedulerToolbar } from './components/SchedulerToolbar';
import { UnassignedSidebar } from './components/UnassignedSidebar';
import { SchedulerGrid } from './components/SchedulerGrid';
import { SubtaskAssignmentModal } from './components/SubtaskAssignmentModal';

export const Scheduler: React.FC = () => {
    const s = useScheduler();

    if (!s.currentUser) return <GenericSkeleton />;

    return (
        <div className="flex flex-col h-auto lg:h-full gap-4 overflow-visible lg:overflow-hidden">
            <SchedulerToolbar
                isMobile={s.isMobile}
                canViewGrid={s.canViewGrid}
                isSectionManager={s.currentUser.role === UserRole.SECTION_MANAGER}
                viewMode={s.viewMode}
                onViewModeChange={s.setViewMode}
                activeTab={s.activeTab}
                onTabChange={s.setActiveTab}
                sections={s.sections}
                selectedSection={s.selectedSection}
                onSectionChange={s.setSelectedSection}
                filterType={s.filterType}
                onTypeChange={s.setFilterType}
                filterPriority={s.filterPriority}
                onPriorityChange={s.setFilterPriority}
                showSunday={s.showSunday}
                onToggleSunday={() => s.setShowSunday(!s.showSunday)}
                headerLabel={s.headerLabel}
                onNavigate={s.handleNavigate}
                onToday={s.handleToday}
            />

            {s.activeTab === 'programacion' && s.canViewGrid && (
                <div className="flex flex-col md:flex-row flex-1 gap-6 overflow-visible lg:overflow-hidden">
                    <UnassignedSidebar
                        unassignedWOs={s.unassignedWOs}
                        technicians={s.technicians}
                        searchTerm={s.sidebarSearchTerm}
                        onSearchChange={s.setSidebarSearchTerm}
                        onDragStart={s.handleDragStart}
                        onSelectWO={s.handleSelectWO}
                        onAssign={s.handleAssign}
                    />
                    <SchedulerGrid
                        viewMode={s.viewMode}
                        daysToShow={s.daysToShow}
                        technicians={s.technicians}
                        workOrders={s.workOrders}
                        selectedSection={s.selectedSection}
                        onClearSection={() => s.setSelectedSection('')}
                        onDragStart={s.handleDragStart}
                        onDragOver={s.handleDragOver}
                        onDrop={s.handleDrop}
                        onUnassign={s.handleUnassign}
                        onSelectWO={s.handleSelectWO}
                        onCreateAtSlot={s.handleOpenCreateModal}
                    />
                </div>
            )}

            {s.activeTab === 'parte' && (
                <div className="flex-1 overflow-auto">
                    <WorkLogGantt
                        workOrders={s.workOrders}
                        users={s.users}
                        currentUser={s.currentUser}
                        currentDate={s.currentDate}
                        viewMode={s.viewMode}
                        showSunday={s.showSunday}
                        onSelectWO={s.handleSelectWO}
                    />
                </div>
            )}

            {s.isCreateModalOpen && (
                <CreateWorkOrderModal
                    onClose={s.handleCloseCreateModal}
                    onSubmit={s.handleCreateSubmit}
                    equipment={s.equipment}
                    users={s.users.filter(u => u.role === UserRole.TECHNICIAN || u.role === UserRole.SECTION_MANAGER)}
                    currentUser={s.currentUser}
                    existingWorkOrders={s.workOrders}
                    sections={s.sections}
                />
            )}

            {s.selectedWO && (
                <WorkOrderDetailModal
                    workOrder={s.selectedWO}
                    onClose={() => s.handleSelectWO(null)}
                    onUpdate={s.handleUpdateSelectedWO}
                    onAddWorkOrder={s.onAddWorkOrder}
                    preventivePlans={s.preventivePlans}
                    currentUser={s.currentUser}
                    users={s.users}
                    equipment={s.equipment}
                    existingWorkOrders={s.workOrders}
                    sections={s.sections}
                    inventory={s.inventory}
                    onUpdateInventory={s.onUpdateInventory}
                />
            )}

            {s.isAssignSubtasksModalOpen && s.pendingAssignment && (
                <SubtaskAssignmentModal
                    pendingAssignment={s.pendingAssignment}
                    users={s.users}
                    assignMain={s.assignMain}
                    onAssignMainChange={s.setAssignMain}
                    selectedSubtasks={s.selectedSubtasksToAssign}
                    onToggleSubtask={(id) =>
                        s.setSelectedSubtasksToAssign(prev =>
                            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                        )
                    }
                    onSelectAll={(ids) => s.setSelectedSubtasksToAssign(ids)}
                    onClearSelection={() => s.setSelectedSubtasksToAssign([])}
                    onClose={() => s.setIsAssignSubtasksModalOpen(false)}
                    onConfirm={s.handleConfirmSubtaskAssignment}
                />
            )}
        </div>
    );
};
