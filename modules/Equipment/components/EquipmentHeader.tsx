import React from 'react';
import { ArrowLeft, X, Box, Settings, Plus, QrCode, ZoomIn, FileText, ClipboardList, Folder, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Equipment, UserRole } from '../../../types';

interface EquipmentHeaderProps {
    selectedEquipment: Equipment;
    isAdmin: boolean;
    isSectionManager: boolean;
    currentUserRole: UserRole;
    mobileSubView: string;
    onGenerateWO: () => void;
    onShowQR: () => void;
    onEdit: () => void;
    onBack: () => void;
    onOpenPhoto: () => void;
    onNavigateMobile: (view: 'work_orders' | 'docs' | 'parts' | 'acceptance') => void;
}

const statusBadge = (status: string) => {
    if (status === 'En Producción') return 'bg-ok-dim text-ok';
    if (status === 'Averiado' || status === 'Baja') return 'bg-ko-dim text-ko';
    if (status === 'Reparación') return 'bg-warn-dim text-warn';
    if (status === 'Inactivo') return 'bg-surface-2 text-txt-2 bg-surface text-txt-3';
    return 'bg-accent-dim text-accent';
};

export const EquipmentHeader: React.FC<EquipmentHeaderProps> = ({
    selectedEquipment,
    isAdmin,
    isSectionManager,
    currentUserRole,
    mobileSubView,
    onGenerateWO,
    onShowQR,
    onEdit,
    onBack,
    onOpenPhoto,
    onNavigateMobile,
}) => {
    return (
        <>
            <div className="md:hidden flex items-center justify-between sticky top-0 bg-surface z-30 py-4 px-1 border-b border-line -mx-6 mb-6">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2.5 bg-surface-2 text-txt-2 hover:text-txt-2 rounded-xl transition-all active:scale-95 border border-line shadow-sm">
                        <ArrowLeft size={24} />
                    </button>
                    <span className="font-bold text-txt truncate">
                        {mobileSubView === 'main' ? 'Detalle de Equipo' :
                            mobileSubView === 'work_orders' ? 'Órdenes de Trabajo' :
                                mobileSubView === 'docs' ? 'Documentación' :
                                    mobileSubView === 'acceptance' ? 'Aceptación' : 'Recambios'}
                    </span>
                </div>
                <button onClick={() => onBack()} className="p-2.5 bg-surface-2 text-txt-3 hover:text-ko rounded-xl transition-all active:scale-95 border border-line shadow-sm">
                    <X size={24} />
                </button>
            </div>

            <div className={`flex flex-col lg:flex-row justify-between items-start gap-6 pb-6 border-b border-line ${mobileSubView !== 'main' ? 'hidden md:flex' : ''}`}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1 w-full">
                    <div
                        className="group relative w-32 h-32 sm:w-28 sm:h-28 rounded-xl bg-surface-2 flex-shrink-0 border border-line overflow-hidden flex items-center justify-center shadow-sm cursor-pointer"
                        onClick={() => selectedEquipment.photoUrl && onOpenPhoto()}
                    >
                        {selectedEquipment.photoUrl ? (
                            <>
                                <img src={selectedEquipment.photoUrl} alt={selectedEquipment.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="text-white" size={24} />
                                </div>
                            </>
                        ) : (
                            <Box size={40} className="text-txt-3" />
                        )}
                    </div>

                    <div className="flex-1 space-y-4 w-full text-center sm:text-left">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-txt tracking-tight">{selectedEquipment.name}</h1>
                            <div className="flex justify-center sm:justify-start gap-2 mt-2">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide ${statusBadge(selectedEquipment.status)}`}>
                                    {selectedEquipment.status}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 text-sm text-txt-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider mb-0.5">Código</span>
                                <span className="font-bold text-accent truncate">{selectedEquipment.code || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider mb-0.5">Fabricante</span>
                                <span className="font-medium text-txt-2 truncate">{selectedEquipment.manufacturer || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider mb-0.5">Nº Serie</span>
                                <span className="font-medium text-txt-2 truncate">{selectedEquipment.serialNumber || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider mb-0.5">Ubicación</span>
                                <span className="font-medium text-txt-2 truncate">{selectedEquipment.location}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex sm:flex-row lg:flex-col gap-2 w-full lg:w-auto mt-4 lg:mt-0">
                    <button
                        onClick={onGenerateWO}
                        className="flex-1 bg-accent hover:bg-accent-2 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/20 active:scale-95 transition-all text-sm md:text-base"
                    >
                        <Plus size={20} />
                        Generar OT
                    </button>
                    <button onClick={onShowQR} className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 text-txt-2 border border-line px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-all font-bold text-[11px] sm:text-sm whitespace-nowrap">
                        <QrCode size={16} />
                        <span>Ver QR</span>
                    </button>
                    {currentUserRole === UserRole.ADMIN && (
                        <button onClick={onEdit} className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 text-txt-2 bg-surface border border-line px-3 py-2.5 rounded-lg hover:bg-surface-2 shadow-sm transition-all font-bold text-[11px] sm:text-sm whitespace-nowrap">
                            <Settings size={16} />
                            <span>Editar</span>
                        </button>
                    )}
                </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 md:hidden mb-24 ${mobileSubView !== 'main' ? 'hidden' : ''}`}>
                <button onClick={onGenerateWO} className="flex items-center gap-4 p-4 bg-surface border border-line rounded-xl shadow-sm hover:bg-surface-2 transition-colors">
                    <div className="w-12 h-12 bg-accent-dim text-accent rounded-full flex items-center justify-center">
                        <FileText size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-txt">Generar OT</h3>
                        <p className="text-xs text-txt-2">Crear incidencia para este equipo</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-txt-3" />
                </button>

                <button onClick={() => onNavigateMobile('work_orders')} className="flex items-center gap-4 p-4 bg-surface border border-line rounded-xl shadow-sm hover:bg-surface-2 transition-colors">
                    <div className="w-12 h-12 bg-accent-dim text-accent rounded-full flex items-center justify-center">
                        <ClipboardList size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-txt">Historial de Órdenes</h3>
                        <p className="text-xs text-txt-2">Ver trabajos realizados y pendientes</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-txt-3" />
                </button>

                <button onClick={() => onNavigateMobile('docs')} className="flex items-center gap-4 p-4 bg-surface border border-line rounded-xl shadow-sm hover:bg-surface-2 transition-colors">
                    <div className="w-12 h-12 bg-spec-dim text-spec rounded-full flex items-center justify-center">
                        <Folder size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-txt">Documentación</h3>
                        <p className="text-xs text-txt-2">Manuales, esquemas y guías</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-txt-3" />
                </button>

                <button onClick={() => onNavigateMobile('parts')} className="flex items-center gap-4 p-4 bg-surface border border-line rounded-xl shadow-sm hover:bg-surface-2 transition-colors">
                    <div className="w-12 h-12 bg-warn-dim text-warn rounded-full flex items-center justify-center">
                        <Box size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-txt">Recambios Vinculados</h3>
                        <p className="text-xs text-txt-2">Gestión de stock y piezas</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-txt-3" />
                </button>

                <button onClick={() => onNavigateMobile('acceptance')} className="flex items-center gap-4 p-4 bg-surface border border-line rounded-xl shadow-sm hover:bg-surface-2 transition-colors">
                    <div className="w-12 h-12 bg-ok-dim text-ok rounded-full flex items-center justify-center">
                        <ClipboardCheck size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-txt">Aceptación</h3>
                        <p className="text-xs text-txt-2">Vistos buenos, formaciones y conformidad</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-txt-3" />
                </button>
            </div>
        </>
    );
};
