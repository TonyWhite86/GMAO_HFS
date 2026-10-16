import React, { useMemo } from 'react';
import { Equipment } from '../../../types';
import { Search, QrCode, ArrowLeft, Box, Folder, ChevronRight, FolderOpen } from 'lucide-react';

interface EquipmentExplorerProps {
    equipmentList: Equipment[];
    filteredEquipment: Equipment[];
    viewRootId: string | undefined;
    setViewRootId: (id: string | undefined) => void;
    selectedEqId: string | null;
    setSelectedEqId: (id: string | null) => void;
    equipmentSearch: string;
    setEquipmentSearch: (term: string) => void;
    onQRScan: () => void;
}

export const EquipmentExplorer: React.FC<EquipmentExplorerProps> = ({
    equipmentList,
    filteredEquipment,
    viewRootId,
    setViewRootId,
    selectedEqId,
    setSelectedEqId,
    equipmentSearch,
    setEquipmentSearch,
    onQRScan
}) => {

    const currentLevelItems = useMemo(() => {
        if (viewRootId) {
            return filteredEquipment.filter(e => e.parentId === viewRootId);
        } else {
            const visibleIds = new Set(filteredEquipment.map(e => e.id));
            return filteredEquipment.filter(e => {
                if (!e.parentId) return true;
                return !visibleIds.has(e.parentId);
            });
        }
    }, [filteredEquipment, viewRootId]);

    const currentRoot = viewRootId ? equipmentList.find(e => e.id === viewRootId) : null;

    const handleNavigateUp = () => {
        if (currentRoot && currentRoot.parentId) {
            const parentIsVisible = filteredEquipment.some(e => e.id === currentRoot.parentId);
            if (parentIsVisible) {
                setViewRootId(currentRoot.parentId);
            } else {
                setViewRootId(undefined);
            }
        } else {
            setViewRootId(undefined);
        }
    };

    return (
        <div className="w-full md:w-96 flex-shrink-0 bg-surface border-r-0 md:border-r border-b md:border-b-0 border-line rounded-lg shadow-sm flex flex-col transition-colors h-full">
            {/* Navigation Header */}
            <div className="p-4 border-b border-line bg-surface-2 rounded-t-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-txt-2">Explorador</h2>
                    {currentRoot && (
                        <span className="text-xs text-txt-3 bg-surface-2 px-2 py-0.5 rounded-full border border-line truncate max-w-[120px]">
                            {currentRoot.name}
                        </span>
                    )}
                </div>

                {/* UP BUTTON - Opposite Side */}
                {viewRootId && (
                    <button
                        onClick={handleNavigateUp}
                        className="flex items-center gap-2 px-4 py-2 bg-accent-dim hover:bg-accent-dim text-accent rounded-xl text-sm font-bold transition-all border border-accent-border active:scale-95 shadow-sm"
                        title="Subir de nivel"
                    >
                        <ArrowLeft size={18} />
                        <span>Subir Nivel</span>
                    </button>
                )}
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-line bg-surface">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={16} />
                        <input
                            type="text"
                            id="equipment-sidebar-search"
                            name="explorerSearch"
                            placeholder="Buscar equipo por nombre o QR..."
                            value={equipmentSearch}
                            onChange={(e) => setEquipmentSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-surface-2 border-none rounded-lg text-sm focus:ring-2 focus:ring-accent text-txt"
                        />
                    </div>
                    <button
                        onClick={onQRScan}
                        className="p-2 bg-surface-2 text-txt-2 rounded-lg hover:bg-surface-3 transition-colors"
                        title="Escanear QR"
                    >
                        <QrCode size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 pb-24 md:pb-2">
                {equipmentSearch ? (
                    // Search Results (Flat List)
                    <div className="space-y-1">
                        {filteredEquipment
                            .map(item => (
                                <div
                                    key={item.id}
                                    className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border-l-4
                    ${selectedEqId === item.id
                                            ? 'bg-accent-dim border-accent'
                                            : 'border-transparent hover:bg-surface-2 '
                                        }
                  `}
                                    onClick={() => {
                                        setSelectedEqId(item.id);
                                    }}
                                >
                                    <div className={`p-2 rounded-lg flex-shrink-0 ${item.parentId ? 'bg-surface-2 text-txt-2 bg-surface text-txt-3' : 'bg-warn-dim text-warn'}`}>
                                        {item.parentId ? <Box size={18} /> : <Folder size={18} />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-medium text-txt truncate">{item.name}</div>
                                        <div className="text-xs text-txt-2 truncate flex items-center gap-1">
                                            <QrCode size={12} />
                                            {item.qrCode}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        {filteredEquipment.length === 0 && (
                            <div className="p-8 text-center text-txt-2">
                                <Search size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No se encontraron equipos</p>
                            </div>
                        )}
                    </div>
                ) : (
                    // Standard Drill-Down Tree
                    <div className="space-y-1">
                        {currentLevelItems.length > 0 ? (
                            currentLevelItems.map(item => {
                                const hasChildren = equipmentList.some(e => e.parentId === item.id);
                                const isSelected = selectedEqId === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        className={`
                        flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border
                        ${selectedEqId === item.id ? 'bg-accent-dim border-accent shadow-sm'
                                                : 'bg-surface border-transparent hover:bg-surface-2  hover:border-line '
                                            }
`}
                                        onClick={() => setSelectedEqId(item.id)}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {/* Icon Indicator */}
                                            <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                            ${hasChildren
                                                    ? 'bg-warn-dim text-warn'
                                                    : 'bg-surface-2 text-txt-2 bg-surface text-txt-3'
                                                }
                          `}>
                                                {hasChildren ? <Folder size={20} /> : <Box size={20} />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-medium truncate ${isSelected ? 'text-accent' : 'text-txt-2'}`}>{item.name}</h3>
                                                <p className="text-xs text-txt-2 truncate">
                                                    {hasChildren ? 'Contiene sub-equipos' : (item.serialNumber || 'Item final')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Drill Down or Select Action */}
                                        {hasChildren && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewRootId(item.id);
                                                }}
                                                className="ml-2 p-3 text-txt-2 hover:text-accent hover:bg-accent-dim rounded-xl transition-all border border-line bg-surface-2/30 active:scale-90"
                                                title="Entrar en carpeta"
                                            >
                                                <ChevronRight size={24} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center text-txt-2">
                                <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                                <p>Carpeta vacía</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
