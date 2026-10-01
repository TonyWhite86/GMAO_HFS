import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRestrictedEquipment } from '../../hooks/useFilteredData';
import { InventoryItem } from '../../types';
import { EquipmentExplorer } from './components/EquipmentExplorer';
import { EquipmentDetail } from './components/EquipmentDetail';
import { EquipmentModal } from './components/EquipmentModal';
import { QRDisplay } from './components/QRDisplay';
import { WorkOrderDetailModal } from '../../components/WorkOrderDetailModal';
import { InventoryDetailModal } from '../../components/InventoryDetailModal';
import { QRScannerModal } from '../../components/QRScannerModal';
import { UserRole, Equipment } from '../../types';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { GenericSkeleton } from '../../components/GenericSkeleton';
import { useSearchFilter } from '../../hooks/useSearchFilter';
import { PageHeader } from '../../components/ui/PageHeader';

export const EquipmentModule: React.FC = () => {
    // Store
    const {
        equipment: equipmentList,
        currentUser,
        addWorkOrder,
        updateWorkOrder,
        inventory,
        updateInventory,
        mergeInventoryItems,
        workOrders,
        users,
        sections,
        preventivePlans
    } = useAppStore();

    // State
    const [viewRootId, setViewRootId] = useState<string | undefined>(undefined);
    const [selectedEqId, setSelectedEqId] = useState<string | null>(null);
    // Filtered Data (Security)
    const searchableEquipment = useRestrictedEquipment(equipmentList, currentUser);

    // Filtered Data (Functionality)
    const {
        searchTerm: equipmentSearch,
        setSearchTerm: setEquipmentSearch,
        filteredData: filteredEquipment
    } = useSearchFilter<Equipment>({
        data: searchableEquipment,
        searchFields: ['name', 'qrCode']
    });

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showQRDisplay, setShowQRDisplay] = useState(false);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);

    // Modal selections
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
    const [selectedInvItem, setSelectedInvItem] = useState<InventoryItem | null>(null);

    const selectedEquipment = selectedEqId ? equipmentList.find(e => e.id === selectedEqId) || null : null;
    const selectedWorkOrder = selectedWorkOrderId ? workOrders.find(wo => wo.id === selectedWorkOrderId) || null : null;


    if (!currentUser) return <GenericSkeleton />;

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
            <div className="flex-none p-4 md:p-6 pb-0 mb-4">
                <PageHeader
                    title="Gestión de Equipos"
                    subtitle="Inventario jerárquico y gestión de activos."
                    actions={
                        currentUser.role === UserRole.ADMIN && (
                            <button
                                onClick={() => {
                                    setIsEditMode(false);
                                    setIsCreateModalOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                            >
                                <Plus size={20} />
                                Nuevo Equipo
                            </button>
                        )
                    }
                />
            </div>

            <div className="flex flex-col md:flex-row flex-1 gap-6 overflow-hidden px-4 md:px-6 pb-4">
                <EquipmentExplorer
                    equipmentList={equipmentList}
                    filteredEquipment={filteredEquipment}
                    viewRootId={viewRootId}
                    setViewRootId={setViewRootId}
                    selectedEqId={selectedEqId}
                    setSelectedEqId={setSelectedEqId}
                    equipmentSearch={equipmentSearch}
                    setEquipmentSearch={setEquipmentSearch}
                    onQRScan={() => setIsQRModalOpen(true)}
                />

                <div className={`
          flex-1 bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-700 overflow-y-auto transition-colors
          fixed inset-0 z-45 md:static md:z-auto rounded-none md:rounded-lg
          ${selectedEqId ? 'block' : 'hidden md:block'}
         `}>
                    <EquipmentDetail
                        selectedEquipment={selectedEquipment}
                        setSelectedEqId={setSelectedEqId}
                        onEdit={() => {
                            setIsEditMode(true);
                            setIsCreateModalOpen(true);
                        }}
                        onSelectWorkOrder={setSelectedWorkOrderId}
                        onSelectInventoryItem={setSelectedInvItem}
                        onShowQR={() => setShowQRDisplay(true)}
                    />
                </div>
            </div>

            {/* Modals */}
            <EquipmentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                equipment={isEditMode ? selectedEquipment : null}
            />

            {showQRDisplay && selectedEquipment && (
                <QRDisplay
                    equipment={selectedEquipment}
                    onClose={() => setShowQRDisplay(false)}
                />
            )}

            {selectedWorkOrder && (
                <WorkOrderDetailModal
                    workOrder={selectedWorkOrder}
                    onClose={() => setSelectedWorkOrderId(null)}
                    onUpdate={(wo) => { updateWorkOrder(wo); setSelectedWorkOrderId(null); }}
                    onAddWorkOrder={addWorkOrder}
                    preventivePlans={preventivePlans}
                    currentUser={currentUser}
                    users={users}
                    equipment={equipmentList}
                    existingWorkOrders={workOrders}
                    sections={sections}
                    inventory={inventory}
                    onUpdateInventory={updateInventory}
                />
            )}

            {selectedInvItem && (
                <InventoryDetailModal
                    item={selectedInvItem}
                    inventory={inventory}
                    allEquipment={equipmentList}
                    onClose={() => setSelectedInvItem(null)}
                    onUpdate={(item) => { updateInventory(item); setSelectedInvItem(null); }}
                    onMerge={(delId, keepId) => mergeInventoryItems(keepId, delId)}
                    isReadOnly={currentUser.role === UserRole.TECHNICIAN}
                    currentUser={currentUser}
                />
            )}

            {isQRModalOpen && (
                <QRScannerModal
                    onClose={() => setIsQRModalOpen(false)}
                    onScan={(code) => {
                        const eq = equipmentList.find(e => e.qrCode === code || e.code === code);
                        if (eq) {
                            // Check access
                            const perms = useAppStore.getState().userPermissions;
                            const invLevel = currentUser.role === UserRole.ADMIN ? 'total' : (perms.find(p => p.userId === currentUser.id && p.module === 'inventory')?.level ?? 'sin_acceso');
                            const hasAccess = invLevel === 'parcial' || invLevel === 'total' || !eq.sections || eq.sections.length === 0 || eq.sections.some(s => currentUser.sections.includes(s));
                            if (hasAccess) {
                                setSelectedEqId(eq.id);
                                setIsQRModalOpen(false);
                            } else {
                                toast.error("No tienes acceso a este equipo");
                            }
                        } else {
                            toast.error("Equipo no encontrado");
                        }
                    }}
                />
            )}

        </div>
    );
};
