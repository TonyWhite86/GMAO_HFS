import React, { useState } from 'react';
import { X, Save, ShoppingCart, Target, Package, ListPlus, Trash2, Search, QrCode } from 'lucide-react';
import { InventoryItem, Equipment, User, POStatus } from '../types';
import { toast } from 'sonner';
import { normalizeForSearch } from '../utils/searchUtils';
import { QRScannerModal } from './QRScannerModal';
import { DuplicateWarning } from './inventory/DuplicateWarning';
import { PackageX, AlertCircle, Plus, ArrowLeft } from 'lucide-react';
import { Modal } from './ui/Modal';

interface PurchaseRequestModalProps {
    onClose: () => void;
    onSubmit: (order: any, items: any[]) => void;
    onAddNewItem: (item: InventoryItem) => Promise<InventoryItem>;
    inventory: InventoryItem[];
    allEquipment: Equipment[];
    currentUser: User;
}

export const PurchaseRequestModal: React.FC<PurchaseRequestModalProps> = ({
    onClose,
    onSubmit,
    inventory,
    allEquipment,
    currentUser,
    onAddNewItem
}) => {
    const [notes, setNotes] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
    const [isRequestingNew, setIsRequestingNew] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemMfr, setNewItemMfr] = useState('');
    const [newItemCat, setNewItemCat] = useState('Repuesto');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [selectedItems, setSelectedItems] = useState<{
        partId: string;
        quantity: number;
        equipmentId?: string;
    }[]>([]);

    const [currentPartId, setCurrentPartId] = useState('');
    const [currentQty, setCurrentQty] = useState<number>(1);
    const [currentEquipId, setCurrentEquipId] = useState('');

    // Sort and filter inventory
    const filteredInventory = React.useMemo(() => {
        // 1. Sort by stock level (low stock first)
        const sorted = [...inventory].sort((a, b) => {
            const aIsLow = a.quantity <= a.minStock;
            const bIsLow = b.quantity <= b.minStock;
            if (aIsLow && !bIsLow) return -1;
            if (!aIsLow && bIsLow) return 1;
            return a.name.localeCompare(b.name);
        });

        // 2. Filter by search term
        if (!searchTerm) return sorted;

        const term = normalizeForSearch(searchTerm);
        return sorted.filter(item =>
            normalizeForSearch(item.name).includes(term) ||
            normalizeForSearch(item.sku).includes(term)
        );
    }, [inventory, searchTerm]);

    const handleAddItem = () => {
        if (!currentPartId) {
            toast.error('Selecciona un repuesto');
            return;
        }
        const finalQty = isNaN(currentQty) ? 0 : currentQty;
        if (finalQty <= 0) {
            toast.error('La cantidad debe ser mayor a 0');
            return;
        }

        setSelectedItems(prev => [
            ...prev,
            { partId: currentPartId, quantity: finalQty, equipmentId: currentEquipId || undefined }
        ]);

        // Reset inputs
        setCurrentPartId('');
        setSearchTerm('');
        setShowSuggestions(false);
        setCurrentQty(1);
        setCurrentEquipId('');
    };

    const handleCreateDraftItem = async () => {
        if (!newItemName.trim()) {
            toast.error('Indique al menos el nombre del artículo');
            return;
        }

        setIsCreatingNew(true);
        try {
            const draftItem: InventoryItem = {
                id: '',
                name: newItemName,
                sku: `PEND-${Date.now().toString().slice(-4)}`,
                manufacturer: newItemMfr,
                quantity: 0,
                minStock: 1,
                category: newItemCat,
                location: 'PENDIENTE',
                price: 0,
                supplier: '',
                qrCode: `PEND-${Math.random().toString(36).substring(7).toUpperCase()}`,
                critic: 'Baja',
                status: 'Draft',
                linkedEquipmentIds: []
            };

            const created = await onAddNewItem(draftItem);
            
            // Add to selected items automatically
            setSelectedItems(prev => [
                ...prev,
                { partId: created.id, quantity: currentQty, equipmentId: currentEquipId || undefined }
            ]);

            // Reset and close sub-form
            setIsRequestingNew(false);
            setNewItemName('');
            setNewItemMfr('');
            setCurrentPartId('');
            setSearchTerm('');
        } catch (error) {
            // Error already handled in store/toast
        } finally {
            setIsCreatingNew(false);
        }
    };

    const handleRemoveItem = (index: number) => {
        setSelectedItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.length === 0) {
            toast.error('Añade al menos un artículo a la solicitud');
            return;
        }

        const order = {
            number: `REQ-${Date.now().toString().slice(-6)}`,
            status: POStatus.REQUESTED,
            requestedBy: currentUser.id,
            requestedDate: new Date().toISOString(),
            notes
        };

        onSubmit(order, selectedItems);
    };

    return (
        <>
            <Modal onClose={onClose} size="lg">
                <Modal.Header
                    onClose={onClose}
                    icon={<div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400"><ShoppingCart size={22} /></div>}
                >
                    Nueva Solicitud de Material
                </Modal.Header>

                <Modal.Body>
                    {/* Add Item Form */}
                    <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <ListPlus size={16} /> Añadir Repuesto
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <div className="space-y-2 relative">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Buscar y Seleccionar Repuesto</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                            <input
                                                type="text"
                                                className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Nombre del repuesto, SKU o QR..."
                                                value={searchTerm}
                                                onFocus={() => setShowSuggestions(true)}
                                                onChange={e => {
                                                    setSearchTerm(e.target.value);
                                                    setShowSuggestions(true);
                                                    if (!e.target.value) setCurrentPartId('');
                                                }}
                                            />
                                            {showSuggestions && searchTerm && !currentPartId && (
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                                    {filteredInventory.length > 0 ? (
                                                        <div className="max-h-[240px] overflow-y-auto">
                                                            {filteredInventory.slice(0, 6).map(item => (
                                                                <button
                                                                    key={item.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCurrentPartId(item.id);
                                                                        setSearchTerm(item.name);
                                                                        setShowSuggestions(false);
                                                                    }}
                                                                    className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 last:border-0 group"
                                                                >
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                            {item.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 font-mono">{item.sku}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className={`text-xs font-bold ${item.quantity <= item.minStock ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                            {item.quantity <= item.minStock && '⚠️ '} {item.quantity} ud.
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 text-center">
                                                            <div className="flex flex-col items-center gap-3 py-2">
                                                                <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400">
                                                                    <PackageX size={32} />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No encontrado</p>
                                                                    <p className="text-xs text-slate-500">¿Es un artículo nuevo?</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setNewItemName(searchTerm);
                                                                        setIsRequestingNew(true);
                                                                        setShowSuggestions(false);
                                                                    }}
                                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2"
                                                                >
                                                                    <Plus size={14} /> Solicitar Artículo Nuevo
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsQRScannerOpen(true)}
                                            className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                                            title="Escanear QR"
                                        >
                                            <QrCode size={20} />
                                        </button>
                                    </div>
                                    {currentPartId && (
                                        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-in fade-in zoom-in-95 duration-200">
                                            <div className="p-1 bg-blue-500 text-white rounded">
                                                <Package size={14} />
                                            </div>
                                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                                                Seleccionado: {inventory.find(i => i.id === currentPartId)?.name}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setCurrentPartId('');
                                                    setSearchTerm('');
                                                }}
                                                className="ml-auto text-blue-400 hover:text-blue-600 p-1"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cantidad</label>
                                <input
                                    type="number"
                                    className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold"
                                    value={isNaN(currentQty) ? '' : currentQty}
                                    onChange={e => setCurrentQty(e.target.value === '' ? NaN : parseInt(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Para Equipo (Opcional)</label>
                                <select
                                    className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                                    value={currentEquipId}
                                    onChange={e => setCurrentEquipId(e.target.value)}
                                >
                                    <option value="">Ninguno</option>
                                    {allEquipment.map(e => (
                                        <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-all"
                        >
                            Añadir a la lista
                        </button>
                    </div>

                    {/* New Item Request Sub-form */}
                    {isRequestingNew && (
                        <div className="bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-800/50 p-5 rounded-xl space-y-4 animate-in slide-in-from-right duration-300">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                    <AlertCircle size={18} /> Nueva Solicitud de Alta
                                </h3>
                                <button 
                                    onClick={() => setIsRequestingNew(false)}
                                    className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2 space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre del Artículo</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                                            value={newItemName}
                                            onChange={e => setNewItemName(e.target.value)}
                                            placeholder="Nombre completo"
                                        />
                                    </div>
                                    <DuplicateWarning name={newItemName} manufacturer={newItemMfr} existingItems={inventory} />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fabricante / Marca</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                                        value={newItemMfr}
                                        onChange={e => setNewItemMfr(e.target.value)}
                                        placeholder="Ej. Siemens, SKF..."
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoría</label>
                                    <select
                                        className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
                                        value={newItemCat}
                                        onChange={e => setNewItemCat(e.target.value)}
                                    >
                                        <option value="Repuesto">Repuesto</option>
                                        <option value="Herramienta">Herramienta</option>
                                        <option value="Consumible">Consumible</option>
                                        <option value="EPI">EPI</option>
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCreateDraftItem}
                                    disabled={isCreatingNew}
                                    className="sm:col-span-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                                >
                                    {isCreatingNew ? 'Creando Borrador...' : 'Confirmar Solicitud de Alta'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Selected Items List */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Package size={16} /> Lista de Material
                        </h3>
                        {selectedItems.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 italic text-sm border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                                No hay artículos añadidos
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {selectedItems.map((item, index) => {
                                    const part = inventory.find(p => p.id === item.partId);
                                    const equip = allEquipment.find(e => e.id === item.equipmentId);
                                    return (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl">
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm">{part?.name}</div>
                                                <div className="text-[10px] text-slate-500 flex gap-2">
                                                    <span>Cant: <b className="text-slate-700 dark:text-slate-300 whitespace-nowrap">{item.quantity} ud.</b></span>
                                                    {equip && <span>Equipo: <b className="text-slate-700 dark:text-slate-300 whitespace-nowrap">{equip.name}</b></span>}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Notas Adicionales</label>
                        <textarea
                            className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                            placeholder="Ej. Material urgente para la reparación de la línea 1..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                </Modal.Body>

                <Modal.Footer>
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium text-sm">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 text-sm"
                    >
                        <Save size={18} /> Enviar Solicitud
                    </button>
                </Modal.Footer>
            </Modal>

            {isQRScannerOpen && (
                <QRScannerModal
                    onClose={() => setIsQRScannerOpen(false)}
                    onScan={(code) => {
                        setSearchTerm(code);
                        setIsQRScannerOpen(false);
                    }}
                />
            )}
        </>
    );
};
