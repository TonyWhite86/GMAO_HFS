import React, { useEffect, useMemo, useState } from 'react';
import { Equipment } from '../../../types';
import { Search, QrCode, Cog, Building2, ChevronRight, Factory, Layers } from 'lucide-react';
import {
    buildEquipmentTree, defaultExpandedIds, getAncestorIds, getEquipmentPath,
    EquipmentTreeNode
} from '../../../utils/equipmentTree';
import { EQUIPMENT_STATUS_DOT } from '../../../constants';
import { EquipmentGroupsModal } from './EquipmentGroupsModal';

interface EquipmentExplorerProps {
    equipmentList: Equipment[];
    filteredEquipment: Equipment[];
    selectedEqId: string | null;
    setSelectedEqId: (id: string | null) => void;
    equipmentSearch: string;
    setEquipmentSearch: (term: string) => void;
    onQRScan: () => void;
}

interface TreeNodeProps {
    node: EquipmentTreeNode;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    selectedEqId: string | null;
    onSelect: (id: string) => void;
    pathOf: (id: string) => string;
}

const TreeNodeRow: React.FC<TreeNodeProps> = ({ node, expandedIds, onToggle, selectedEqId, onSelect, pathOf }) => {
    const { equipment: eq, children } = node;
    const hasChildren = children.length > 0;
    const isExpanded = hasChildren && expandedIds.has(eq.id);
    const isSelected = selectedEqId === eq.id;

    return (
        <div className="tree-node">
            <div
                className={`tree-row ${isSelected ? 'active' : ''}`}
                onClick={() => onSelect(eq.id)}
                title={pathOf(eq.id)}
            >
                {hasChildren ? (
                    <button
                        className={`tree-toggle ${isExpanded ? 'open' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle(eq.id);
                        }}
                        aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                    >
                        <ChevronRight size={14} />
                    </button>
                ) : (
                    <span className="w-4 shrink-0" />
                )}
                <span className="tree-icon" style={{ background: hasChildren ? 'var(--amberdim)' : 'var(--surface2)', color: hasChildren ? 'var(--amber)' : 'var(--text3)' }}>
                    {hasChildren ? <Building2 size={14} /> : <Cog size={14} />}
                </span>
                <span className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium text-txt'}`}>
                    {eq.name}
                </span>
                <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: EQUIPMENT_STATUS_DOT[eq.status] || 'var(--text3)' }}
                    title={eq.status}
                />
                {hasChildren && (
                    <span className="text-[10px] text-txt-3 shrink-0 ml-auto">
                        {children.length}
                    </span>
                )}
            </div>
            {isExpanded && children.length > 0 && (
                <div className="tree-children">
                    {children.map(child => (
                        <TreeNodeRow
                            key={child.equipment.id}
                            node={child}
                            expandedIds={expandedIds}
                            onToggle={onToggle}
                            selectedEqId={selectedEqId}
                            onSelect={onSelect}
                            pathOf={pathOf}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const EquipmentExplorer: React.FC<EquipmentExplorerProps> = ({
    equipmentList,
    filteredEquipment,
    selectedEqId,
    setSelectedEqId,
    equipmentSearch,
    setEquipmentSearch,
    onQRScan
}) => {
    const tree = useMemo(() => buildEquipmentTree(equipmentList), [equipmentList]);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(
        () => defaultExpandedIds(equipmentList, selectedEqId)
    );
    const [isGroupsOpen, setIsGroupsOpen] = useState(false);

    // Auto-expandir la rama del equipo seleccionado (p.ej. desde búsqueda o QR).
    useEffect(() => {
        if (!selectedEqId) return;
        const ancestors = getAncestorIds(equipmentList, selectedEqId);
        if (ancestors.length === 0) return;
        setExpandedIds(prev => {
            const next = new Set(prev);
            let changed = false;
            for (const id of ancestors) {
                if (!next.has(id)) {
                    next.add(id);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [selectedEqId, equipmentList]);

    const toggle = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const pathOf = (id: string) => getEquipmentPath(equipmentList, id);

    const handleSelect = (id: string) => {
        setSelectedEqId(id);
        // Al elegir desde el árbol no hay búsqueda activa que limpiar.
    };

    const handleSelectFromSearch = (id: string) => {
        setSelectedEqId(id);
        setEquipmentSearch('');
    };

    return (
        <div className="w-full md:w-96 flex-shrink-0 bg-surface border-r-0 md:border-r border-b md:border-b-0 border-line rounded-lg shadow-sm flex flex-col transition-colors h-full">
            {/* Navigation Header */}
            <div className="p-4 border-b border-line bg-surface-2 rounded-t-lg flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-txt-2">Explorador</h2>
                    <span className="text-xs text-txt-3 bg-surface-2 px-2 py-0.5 rounded-full border border-line">
                        {equipmentList.length} equipos
                    </span>
                </div>
                <button
                    onClick={() => setIsGroupsOpen(true)}
                    className="btn btn-ghost btn-sm"
                    title="Gestionar grupos de equipos"
                >
                    <Layers size={13} />
                    Grupos
                </button>
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
                                    onClick={() => handleSelectFromSearch(item.id)}
                                >
                                    <div className={`p-2 rounded-lg flex-shrink-0 ${item.parentId ? 'bg-surface-2 text-txt-2' : 'bg-warn-dim text-warn'}`}>
                                        {item.parentId ? <Cog size={18} /> : <Building2 size={18} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-txt truncate flex items-center gap-2">
                                            <span className="truncate">{item.name}</span>
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ background: EQUIPMENT_STATUS_DOT[item.status] || 'var(--text3)' }}
                                                title={item.status}
                                            />
                                        </div>
                                        <div className="text-xs text-txt-2 truncate">
                                            {getEquipmentPath(equipmentList, item.id)}
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
                    // Árbol expandible con conectores curvos
                    <div className="tree-root">
                        <div
                            className={`tree-row ${selectedEqId === null ? '' : ''}`}
                            style={{ paddingLeft: 8 }}
                        >
                            <span className="tree-icon" style={{ background: 'var(--accentdim)', color: 'var(--accent)' }}>
                                <Factory size={14} />
                            </span>
                            <span className="text-sm font-semibold text-txt-2">Todos los equipos</span>
                        </div>
                        {tree.length > 0 ? (
                            <div className="tree-children">
                                {tree.map(node => (
                                    <TreeNodeRow
                                        key={node.equipment.id}
                                        node={node}
                                        expandedIds={expandedIds}
                                        onToggle={toggle}
                                        selectedEqId={selectedEqId}
                                        onSelect={handleSelect}
                                        pathOf={pathOf}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-txt-2">
                                <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No hay equipos registrados</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isGroupsOpen && (
                <EquipmentGroupsModal
                    isOpen={isGroupsOpen}
                    onClose={() => setIsGroupsOpen(false)}
                />
            )}
        </div>
    );
};
