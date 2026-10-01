import React, { useState } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Equipment, InventoryItem, WorkOrder, WOType, UserRole } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { usePermissions } from '../../../hooks/usePermissions';
import { OrderTypeSelectionModal } from '../../Maintenance/components/OrderTypeSelectionModal';
import { CreateWorkOrderModal } from '../../../components/CreateWorkOrderModal';
import { CreatePlannedModal } from '../../../components/CreatePlannedModal';
import { EquipmentHeader } from './EquipmentHeader';
import { EquipmentWorkOrders } from './EquipmentWorkOrders';
import { EquipmentDocuments } from './EquipmentDocuments';
import { EquipmentParts } from './EquipmentParts';

interface EquipmentDetailProps {
    selectedEquipment: Equipment | null;
    setSelectedEqId: (id: string | null) => void;
    onEdit: () => void;
    onSelectWorkOrder: (id: string) => void;
    onSelectInventoryItem: (item: InventoryItem) => void;
    onShowQR: () => void;
}

export const EquipmentDetail: React.FC<EquipmentDetailProps> = ({
    selectedEquipment,
    setSelectedEqId,
    onEdit,
    onSelectWorkOrder,
    onSelectInventoryItem,
    onShowQR
}) => {
    const { currentUser, users, workOrders, inventory, addWorkOrder, sections, equipment: allEquipmentList } = useAppStore();

    const { isAdmin, isSectionManager } = usePermissions(currentUser);
    const [activeMainTab, setActiveMainTab] = useState<'work_orders' | 'docs' | 'parts'>('work_orders');
    const [mobileSubView, setMobileSubView] = useState<'main' | 'work_orders' | 'docs' | 'parts'>('main');
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
    const [isCreateWOModalOpen, setIsCreateWOModalOpen] = useState(false);
    const [isSelectTypeModalOpen, setIsSelectTypeModalOpen] = useState(false);
    const [isCreatePlannedModalOpen, setIsCreatePlannedModalOpen] = useState(false);
    const [selectedTypeForModal, setSelectedTypeForModal] = useState<WOType>(WOType.CORRECTIVE);

    if (!currentUser) return null;

    if (!selectedEquipment) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 sticky top-0">
                <FolderOpen size={64} className="mx-auto mb-4 text-slate-200 dark:text-slate-700" />
                <p>Selecciona un equipo para ver los detalles</p>
            </div>
        );
    }

    const handleCreateWOSubmit = async (newWO: WorkOrder) => {
        try {
            await addWorkOrder(newWO);
            setIsCreateWOModalOpen(false);
            setIsCreatePlannedModalOpen(false);
            toast.success('Orden de Trabajo creada');
        } catch (error) {
            console.error('Error creating WO:', error);
            toast.error('Error al crear la Orden de Trabajo');
        }
    };

    const handleSelectType = (type: WOType | 'PREVENTIVE') => {
        setIsSelectTypeModalOpen(false);
        if (type === 'PREVENTIVE') {
            setIsCreatePlannedModalOpen(true);
        } else {
            setSelectedTypeForModal(type);
            setIsCreateWOModalOpen(true);
        }
    };

    const handleGenerateWO = () => {
        if (isAdmin || isSectionManager) {
            setIsSelectTypeModalOpen(true);
        } else {
            setSelectedTypeForModal(WOType.CORRECTIVE);
            setIsCreateWOModalOpen(true);
        }
    };

    const handleNavigateMobile = (view: 'work_orders' | 'docs' | 'parts') => {
        setMobileSubView(view);
        setActiveMainTab(view);
    };

    const handleBack = () => {
        if (mobileSubView !== 'main') {
            setMobileSubView('main');
        } else {
            setSelectedEqId(null);
        }
    };

    return (
        <div className="p-6 pb-48 md:pb-6 space-y-8 relative">
            <EquipmentHeader
                selectedEquipment={selectedEquipment}
                isAdmin={isAdmin}
                isSectionManager={isSectionManager}
                currentUserRole={currentUser.role}
                mobileSubView={mobileSubView}
                onGenerateWO={handleGenerateWO}
                onShowQR={onShowQR}
                onEdit={onEdit}
                onBack={handleBack}
                onOpenPhoto={() => setIsPhotoZoomed(true)}
                onNavigateMobile={handleNavigateMobile}
            />

            {/* Tabs Navigation (Desktop) */}
            <div className="hidden md:block border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex sm:space-x-8">
                    <button onClick={() => setActiveMainTab('work_orders')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeMainTab === 'work_orders' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>Órdenes</button>
                    <button onClick={() => setActiveMainTab('docs')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeMainTab === 'docs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>Docs</button>
                    <button onClick={() => setActiveMainTab('parts')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeMainTab === 'parts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}>Recambios</button>
                </nav>
            </div>

            {/* Content Areas */}
            <div className={`pt-2 ${mobileSubView === 'main' ? 'hidden md:block' : ''}`}>
                {activeMainTab === 'work_orders' && (
                    <EquipmentWorkOrders equipmentId={selectedEquipment.id} onSelectWorkOrder={onSelectWorkOrder} />
                )}
                {activeMainTab === 'docs' && (
                    <EquipmentDocuments selectedEquipment={selectedEquipment} />
                )}
                {activeMainTab === 'parts' && (
                    <EquipmentParts selectedEquipment={selectedEquipment} onSelectInventoryItem={onSelectInventoryItem} currentUser={currentUser} />
                )}
            </div>

            {/* Photo Zoom Modal */}
            {isPhotoZoomed && selectedEquipment.photoUrl && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsPhotoZoomed(false)}>
                    <button className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all" onClick={() => setIsPhotoZoomed(false)}>
                        <X size={32} />
                    </button>
                    <img src={selectedEquipment.photoUrl} alt={selectedEquipment.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()} />
                </div>
            )}

            {isSelectTypeModalOpen && (
                <OrderTypeSelectionModal
                    onClose={() => setIsSelectTypeModalOpen(false)}
                    onSelectCorrective={() => handleSelectType(WOType.CORRECTIVE)}
                    onSelectPreventive={() => handleSelectType('PREVENTIVE')}
                    onSelectPlanned={() => handleSelectType(WOType.PLANNED)}
                />
            )}

            {isCreateWOModalOpen && (
                <CreateWorkOrderModal
                    onClose={() => setIsCreateWOModalOpen(false)}
                    onSubmit={handleCreateWOSubmit}
                    users={users}
                    currentUser={currentUser}
                    equipment={allEquipmentList}
                    sections={sections}
                    existingWorkOrders={workOrders}
                    initialEquipmentId={selectedEquipment.id}
                    initialType={selectedTypeForModal}
                />
            )}

            {isCreatePlannedModalOpen && (
                <CreatePlannedModal
                    onClose={() => setIsCreatePlannedModalOpen(false)}
                    onSubmit={handleCreateWOSubmit}
                    equipment={allEquipmentList}
                    users={users}
                    currentUser={currentUser}
                    sections={sections}
                    existingWorkOrders={workOrders}
                />
            )}
        </div>
    );
};
