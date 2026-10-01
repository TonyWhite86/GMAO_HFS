import React from 'react';
import { ArrowLeft, X, Box, Settings, Plus, QrCode, ZoomIn, FileText, ClipboardList, Folder, ChevronRight } from 'lucide-react';
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
    onNavigateMobile: (view: 'work_orders' | 'docs' | 'parts') => void;
}

const statusBadge = (status: string) => {
    if (status === 'En Producción') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (status === 'Averiado' || status === 'Baja') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    if (status === 'Reparación') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (status === 'Inactivo') return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
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
            <div className="md:hidden flex items-center justify-between sticky top-0 bg-white dark:bg-slate-700 z-30 py-4 px-1 border-b border-slate-100 dark:border-slate-700 -mx-6 mb-6">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-300 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-600 shadow-sm">
                        <ArrowLeft size={24} />
                    </button>
                    <span className="font-bold text-slate-800 dark:text-white truncate">
                        {mobileSubView === 'main' ? 'Detalle de Equipo' :
                            mobileSubView === 'work_orders' ? 'Órdenes de Trabajo' :
                                mobileSubView === 'docs' ? 'Documentación' : 'Recambios'}
                    </span>
                </div>
                <button onClick={() => onBack()} className="p-2.5 bg-slate-100 dark:bg-slate-700/50 text-slate-400 hover:text-red-500 rounded-xl transition-all active:scale-95 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <X size={24} />
                </button>
            </div>

            <div className={`flex flex-col lg:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-100 dark:border-slate-700 ${mobileSubView !== 'main' ? 'hidden md:flex' : ''}`}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1 w-full">
                    <div
                        className="group relative w-32 h-32 sm:w-28 sm:h-28 rounded-xl bg-slate-100 dark:bg-slate-700 flex-shrink-0 border border-slate-200 dark:border-slate-600 overflow-hidden flex items-center justify-center shadow-sm cursor-pointer"
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
                            <Box size={40} className="text-slate-300 dark:text-slate-500" />
                        )}
                    </div>

                    <div className="flex-1 space-y-4 w-full text-center sm:text-left">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{selectedEquipment.name}</h1>
                            <div className="flex justify-center sm:justify-start gap-2 mt-2">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wide ${statusBadge(selectedEquipment.status)}`}>
                                    {selectedEquipment.status}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Código</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400 truncate">{selectedEquipment.code || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Fabricante</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{selectedEquipment.manufacturer || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Nº Serie</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{selectedEquipment.serialNumber || '-'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Ubicación</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{selectedEquipment.location}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex sm:flex-row lg:flex-col gap-2 w-full lg:w-auto mt-4 lg:mt-0">
                    <button
                        onClick={onGenerateWO}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm md:text-base"
                    >
                        <Plus size={20} />
                        Generar OT
                    </button>
                    <button onClick={onShowQR} className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all font-bold text-[11px] sm:text-sm whitespace-nowrap">
                        <QrCode size={16} />
                        <span>Ver QR</span>
                    </button>
                    {currentUserRole === UserRole.ADMIN && (
                        <button onClick={onEdit} className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition-all font-bold text-[11px] sm:text-sm whitespace-nowrap">
                            <Settings size={16} />
                            <span>Editar</span>
                        </button>
                    )}
                </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 md:hidden mb-24 ${mobileSubView !== 'main' ? 'hidden' : ''}`}>
                <button onClick={onGenerateWO} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center">
                        <FileText size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800 dark:text-white">Generar OT</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Crear incidencia para este equipo</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-slate-400" />
                </button>

                <button onClick={() => onNavigateMobile('work_orders')} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                        <ClipboardList size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800 dark:text-white">Historial de Órdenes</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Ver trabajos realizados y pendientes</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-slate-400" />
                </button>

                <button onClick={() => onNavigateMobile('docs')} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center">
                        <Folder size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800 dark:text-white">Documentación</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Manuales, esquemas y guías</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-slate-400" />
                </button>

                <button onClick={() => onNavigateMobile('parts')} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center">
                        <Box size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800 dark:text-white">Recambios Vinculados</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Gestión de stock y piezas</p>
                    </div>
                    <ChevronRight size={20} className="ml-auto text-slate-400" />
                </button>
            </div>
        </>
    );
};
