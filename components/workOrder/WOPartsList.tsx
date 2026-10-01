import React, { useState, useMemo } from 'react';
import { Package, Plus, X, Search, QrCode } from 'lucide-react';
import { WorkOrder, InventoryItem } from '../../types';
import { QRScannerModal } from '../QRScannerModal';


interface WOPartsListProps {
    editedWO: WorkOrder;
    setEditedWO: (wo: WorkOrder) => void;
    isEditing: boolean;
    inventory: InventoryItem[];
}


export const WOPartsList: React.FC<WOPartsListProps> = ({
    editedWO,
    setEditedWO,
    isEditing,
    inventory
}) => {
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);

    const [showPartSearch, setShowPartSearch] = useState(false);
    const [partSearch, setPartSearch] = useState('');
    const [partQty, setPartQty] = useState(1);

    const filteredParts = useMemo(() => {
        if (!partSearch.trim()) return [];
        const term = partSearch.toLowerCase();
        return inventory.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term) ||
            p.qrCode === partSearch
        );
    }, [inventory, partSearch]);

    const getPartName = (partId: string) => {
        return inventory.find(p => p.id === partId)?.name || 'Repuesto no encontrado';
    };

    const getPartSku = (partId: string) => {
        return inventory.find(p => p.id === partId)?.sku || '---';
    };

    const handleRemovePart = (partId: string) => {
        const updatedParts = (editedWO.usedParts || []).filter(p => p.partId !== partId);
        setEditedWO({ ...editedWO, usedParts: updatedParts });
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Package size={16} /> Repuestos y Materiales
                </label>
                {isEditing && !showPartSearch && (
                    <button
                        onClick={() => setShowPartSearch(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-xs font-medium active:scale-95 shadow-sm shadow-blue-600/20"
                    >
                        <Plus size={14} />
                        <span>Añadir Repuesto</span>
                    </button>
                )}
            </div>

            {/* Search Box */}
            {isEditing && showPartSearch && (
                <div className="mb-4 p-4 bg-slate-800/20 rounded-2xl animate-fadeIn border border-slate-800/60 shadow-sm relative">
                    <button
                        onClick={() => setShowPartSearch(false)}
                        className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex flex-col gap-3 mt-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Buscar Repuesto</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Nombre, SKU o escanear..."
                                    className="w-full pl-10 pr-10 p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all placeholder:text-slate-600"
                                    value={partSearch}
                                    onChange={(e) => setPartSearch(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsQRModalOpen(true)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-400 transition-colors"
                                    title="Escanear QR"
                                >
                                    <QrCode size={18} />
                                </button>
                            </div>
                            <div className="w-20">
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-center outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
                                    value={isNaN(partQty) ? '' : partQty}
                                    onChange={(e) => setPartQty(e.target.value === '' ? NaN : parseInt(e.target.value))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Results Dropdown */}
                    {partSearch && (
                        <div className="mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg max-h-48 overflow-y-auto shadow-xl z-20">
                            {filteredParts.length > 0 ? (
                                filteredParts.map(part => (
                                    <div
                                        key={part.id}
                                        onClick={() => {
                                            const existingIndex = (editedWO.usedParts || []).findIndex(p => p.partId === part.id);
                                            let updatedParts = [...(editedWO.usedParts || [])];
                                            const finalQty = isNaN(partQty) ? 1 : partQty;
                                            if (existingIndex >= 0) {
                                                updatedParts[existingIndex] = { ...updatedParts[existingIndex], quantity: updatedParts[existingIndex].quantity + finalQty };
                                            } else {
                                                updatedParts.push({ partId: part.id, quantity: finalQty });
                                            }
                                            setEditedWO({ ...editedWO, usedParts: updatedParts });
                                            setPartSearch('');
                                            setShowPartSearch(false);
                                            setPartQty(1);
                                        }}
                                        className="p-3 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer text-sm flex justify-between items-center border-b border-slate-100 dark:border-slate-800 last:border-0 group"
                                    >
                                        <div>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                {part.name}
                                                {part.qrCode === partSearch && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">Coincidencia QR</span>}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono mt-0.5">{part.sku}</div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-400 block mb-1">Stock: {part.quantity}</span>
                                            <span className="inline-flex items-center gap-1 text-blue-600 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100 px-2 py-1 rounded">
                                                Añadir <Plus size={14} />
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-slate-500">
                                    <Package size={24} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No se encontraron repuestos</p>
                                    <p className="text-xs text-slate-400 mt-1">Prueba con otro término o SKU</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* List of Used Parts */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                {(editedWO.usedParts && editedWO.usedParts.length > 0) ? (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                            <tr>
                                <th className="p-3">Repuesto</th>
                                <th className="p-3 w-32 sm:w-48 text-center">SKU</th>
                                <th className="p-3 w-20 text-center">Cant.</th>
                                {isEditing && <th className="p-3 w-12"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {editedWO.usedParts.map((part, idx) => (
                                <tr key={idx} className="group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{getPartName(part.partId)}</td>
                                    <td className="p-3 text-slate-500 text-xs font-mono whitespace-nowrap text-center">
                                        <span className="px-2 py-1 bg-slate-200/50 dark:bg-slate-700 rounded">
                                            {getPartSku(part.partId)}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center text-slate-700 dark:text-slate-300 font-bold">{part.quantity}</td>
                                    {isEditing && (
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => handleRemovePart(part.partId)}
                                                className="p-1 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={14} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-3 text-center text-slate-400 text-sm italic">
                        No se han asignado repuestos.
                    </div>
                )}
            </div>
            {isQRModalOpen && (
                <QRScannerModal
                    onClose={() => setIsQRModalOpen(false)}
                    onScan={(code) => {
                        setPartSearch(code);
                        setIsQRModalOpen(false);
                        setShowPartSearch(true);
                    }}
                />
            )}
        </div>
    );
};

