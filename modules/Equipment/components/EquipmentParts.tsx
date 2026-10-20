import React, { useState } from 'react';
import { Box, Plus, X, Search, Trash2 } from 'lucide-react';
import { Equipment, InventoryItem, User, UserRole } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { toast } from 'sonner';

interface EquipmentPartsProps {
    selectedEquipment: Equipment;
    onSelectInventoryItem: (item: InventoryItem) => void;
    currentUser: User;
}

export const EquipmentParts: React.FC<EquipmentPartsProps> = ({ selectedEquipment, onSelectInventoryItem, currentUser }) => {
    const { inventory, updateInventory } = useAppStore();

    const [isLinkingPart, setIsLinkingPart] = useState(false);
    const [partSearchTerm, setPartSearchTerm] = useState('');

    const getLinkedParts = () => {
        return inventory.filter(item => item.linkedEquipmentIds?.includes(selectedEquipment.id));
    };

    const filteredPartsForLinking = inventory.filter(item => {
        const isAlreadyLinked = item.linkedEquipmentIds?.includes(selectedEquipment.id);
        const matchesSearch = item.name.toLowerCase().includes(partSearchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(partSearchTerm.toLowerCase());
        return !isAlreadyLinked && matchesSearch;
    });

    const handleLinkPart = async (partId: string) => {
        const part = inventory.find(i => i.id === partId);
        if (part) {
            const updatedIds = [...(part.linkedEquipmentIds || []), selectedEquipment.id];
            await updateInventory({ ...part, linkedEquipmentIds: updatedIds });
            setIsLinkingPart(false);
            setPartSearchTerm('');
            toast.success('Pieza vinculada correctamente');
        }
    };

    const handleUnlinkPart = async (partId: string) => {
        if (!confirm('¿Desvincular pieza de este equipo?')) return;
        const part = inventory.find(i => i.id === partId);
        if (part) {
            const updatedIds = (part.linkedEquipmentIds || []).filter(id => id !== selectedEquipment.id);
            await updateInventory({ ...part, linkedEquipmentIds: updatedIds });
            toast.success('Pieza desvinculada');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-txt flex items-center gap-2">
                    <Box size={20} className="text-accent" />
                    Recambios Vinculados
                </h3>

                {currentUser.role !== UserRole.TECHNICIAN && (
                    <button onClick={() => setIsLinkingPart(!isLinkingPart)} className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-sm ${isLinkingPart ? 'bg-surface-2 text-txt-2' : 'bg-accent text-white hover:bg-accent-2 shadow-accent/20'}`}>
                        {isLinkingPart ? <X size={18} /> : <Plus size={18} />}
                        {isLinkingPart ? 'Cancelar' : 'Vincular Recambio'}
                    </button>
                )}
            </div>

            {isLinkingPart && (
                <div className="bg-accent-dim/50 border border-accent-border rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={18} />
                            <input autoFocus placeholder="Buscar por nombre o SKU..." value={partSearchTerm} onChange={e => setPartSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-surface border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {filteredPartsForLinking.map(p => (
                                <div key={p.id} onClick={() => handleLinkPart(p.id)} className="group p-3 bg-surface border border-line rounded-xl hover:border-accent cursor-pointer transition-all flex items-center gap-3">
                                    <div className="w-10 h-10 bg-surface-2 rounded-lg flex items-center justify-center group-hover:bg-accent-dim transition-colors">
                                        <Box size={20} className="text-txt-3 group-hover:text-accent" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-txt truncate">{p.name}</div>
                                        <div className="text-xs text-txt-2">{p.sku}</div>
                                    </div>
                                    <Plus size={16} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                            {partSearchTerm && filteredPartsForLinking.length === 0 && (
                                <div className="col-span-full py-8 text-center text-txt-2 italic bg-surface rounded-xl border border-dashed border-line">
                                    No se encontraron recambios disponibles
                                </div>
                            )}
                            {!partSearchTerm && (
                                <div className="col-span-full py-8 text-center text-txt-3 text-sm">
                                    Empieza a escribir para buscar...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <div className="md:hidden space-y-3">
                    {getLinkedParts().map(p => (
                        <div key={p.id} className="p-4 bg-surface border border-line rounded-2xl shadow-sm space-y-3" onClick={() => onSelectInventoryItem(p)}>
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center shrink-0">
                                    <Box size={24} className="text-txt-3" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-txt truncate">{p.name}</div>
                                    <div className="text-xs text-txt-2">{p.sku}</div>
                                </div>
                                {currentUser.role !== UserRole.TECHNICIAN && (
                                    <button onClick={(e) => { e.stopPropagation(); handleUnlinkPart(p.id); }} className="p-2 text-txt-3 hover:text-ko hover:bg-ko-dim rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-xs pt-3 border-t border-line">
                                <span className="text-txt-2">Stock Actual</span>
                                <span className={`font-bold ${p.quantity <= p.minStock ? 'text-ko' : 'text-ok'}`}>
                                    {p.quantity} unidades
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="hidden md:block bg-surface rounded-2xl border border-line overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-line bg-surface-2/50 bg-surface text-xs text-txt-2 uppercase font-bold">
                                <th className="p-4">Recambio</th>
                                <th className="p-4">SKU</th>
                                <th className="p-4">Stock</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {getLinkedParts().map(p => (
                                <tr key={p.id} className="group hover:bg-surface-2 transition-colors cursor-pointer" onClick={() => onSelectInventoryItem(p)}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-surface-2 rounded-lg flex items-center justify-center">
                                                <Box size={16} className="text-txt-3" />
                                            </div>
                                            <span className="font-bold text-txt">{p.name}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-txt-2 font-mono text-sm">{p.sku}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${p.quantity <= p.minStock ? 'bg-ko-dim text-ko' : 'bg-ok-dim text-ok'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${p.quantity <= p.minStock ? 'bg-ko' : 'bg-ok'}`} />
                                            {p.quantity} uds
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {currentUser.role !== UserRole.TECHNICIAN && (
                                            <button onClick={(e) => { e.stopPropagation(); handleUnlinkPart(p.id); }} className="p-2 text-txt-3 hover:text-ko hover:bg-ko-dim rounded-lg transition-colors" title="Desvincular">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {getLinkedParts().length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 bg-surface-2/50 bg-surface/20 border-2 border-dashed border-line rounded-3xl">
                        <div className="w-16 h-16 bg-surface rounded-2xl shadow-sm flex items-center justify-center mb-4">
                            <Box size={32} className="text-txt-3" />
                        </div>
                        <p className="text-txt-2 font-bold text-lg">Sin recambios vinculados</p>
                        <p className="text-txt-3 text-sm mt-1 max-w-[280px] text-center">
                            Vincula las piezas que se usan habitualmente en el mantenimiento de este equipo.
                        </p>
                        {currentUser.role !== UserRole.TECHNICIAN && (
                            <button onClick={() => setIsLinkingPart(true)} className="mt-6 px-6 py-2.5 bg-accent text-white rounded-xl font-bold hover:bg-accent-2 transition-all shadow-lg shadow-accent/20 active:scale-95">
                                Vincular ahora
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
