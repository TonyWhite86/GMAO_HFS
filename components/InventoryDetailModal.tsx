import React, { useState, useRef, useMemo } from 'react';
import { InventoryItem, SupplierInfo, Equipment, User, UserRole } from '../types';
import { X, AlertTriangle, MapPin, Tag, Package, Printer, Save, Edit2, Upload, Trash2, Image as ImageIcon, Plus, DollarSign, Calendar, Boxes, Link2, Search, ArrowRightLeft, ArrowRight } from 'lucide-react';
import { normalizeForSearch } from '../utils/searchUtils';
import { QRCodeSVG } from 'qrcode.react';
import { QRLabel } from './common/QRLabel';

interface InventoryDetailModalProps {
    item: InventoryItem;
    inventory: InventoryItem[];
    allEquipment: Equipment[];
    onClose: () => void;
    onUpdate: (item: InventoryItem) => void;
    onMerge: (deleteId: string, keepId: string) => Promise<void>;
    isReadOnly?: boolean;
    currentUser: User;
}

export const InventoryDetailModal: React.FC<InventoryDetailModalProps> = ({ 
    item, 
    inventory, 
    allEquipment, 
    onClose, 
    onUpdate, 
    onMerge,
    isReadOnly, 
    currentUser 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState<InventoryItem>({ ...item });
    const [activeTab, setActiveTab] = useState<'details' | 'suppliers' | 'linked'>('details');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canEdit = useMemo(() => {
        if (currentUser.role === UserRole.ADMIN) return true;
        if (currentUser.role === UserRole.SECTION_MANAGER) {
            return currentUser.sections.some(s => s.toLowerCase().includes('almacen') || s.toLowerCase().includes('almacén'));
        }
        return false;
    }, [currentUser]);

    // Price Visibility Logic (Maintaining existing logic but ensuring consistency)
    const canViewPrice = useMemo(() => {
        if (currentUser.role === UserRole.ADMIN) return true;
        if (currentUser.role === UserRole.SECTION_MANAGER) {
            return currentUser.sections.some(s => s.toLowerCase().includes('almacen') || s.toLowerCase().includes('almacén'));
        }
        return currentUser.role !== UserRole.TECHNICIAN;
    }, [currentUser]);

    // Supplier editing state
    const [newSupplier, setNewSupplier] = useState<SupplierInfo>({
        id: '',
        name: '',
        lastPrice: NaN,
        lastDate: new Date().toISOString().split('T')[0],
        lastQuantity: NaN
    });
    const [isAddingSupplier, setIsAddingSupplier] = useState(false);

    // Equipment linking state
    const [isLinkingEq, setIsLinkingEq] = useState(false);
    const [eqSearchTerm, setEqSearchTerm] = useState('');

    // Merging state
    const [isMerging, setIsMerging] = useState(false);
    const [mergeSearchTerm, setMergeSearchTerm] = useState('');
    const [confirmingMergeId, setConfirmingMergeId] = useState<string | null>(null);
    const [isProcessingMerge, setIsProcessingMerge] = useState(false);

    const handleSave = () => {
        const safeItem = {
            ...editedItem,
            quantity: isNaN(editedItem.quantity) ? 0 : editedItem.quantity,
            minStock: isNaN(editedItem.minStock) ? 0 : editedItem.minStock,
            price: isNaN(editedItem.price) ? 0 : editedItem.price
        };
        onUpdate(safeItem);
        setIsEditing(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditedItem(prev => ({ ...prev, image: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddSupplier = () => {
        const supplierToAdd = {
            ...newSupplier,
            id: `sup-${Date.now()}`,
            lastPrice: isNaN(newSupplier.lastPrice) ? 0 : newSupplier.lastPrice,
            lastQuantity: isNaN(newSupplier.lastQuantity) ? 0 : newSupplier.lastQuantity
        };
        const updatedSuppliers = [...(editedItem.suppliers || []), supplierToAdd];
        setEditedItem({ ...editedItem, suppliers: updatedSuppliers });
        setNewSupplier({ id: '', name: '', lastPrice: NaN, lastDate: new Date().toISOString().split('T')[0], lastQuantity: NaN });
        setIsAddingSupplier(false);
    };

    const handleRemoveSupplier = (id: string) => {
        const updatedSuppliers = (editedItem.suppliers || []).filter(s => s.id !== id);
        setEditedItem({ ...editedItem, suppliers: updatedSuppliers });
    };

    const handleLinkEquipment = (eqId: string) => {
        const currentLinks = editedItem.linkedEquipmentIds || [];
        if (!currentLinks.includes(eqId)) {
            setEditedItem({ ...editedItem, linkedEquipmentIds: [...currentLinks, eqId] });
        }
        setIsLinkingEq(false);
        setEqSearchTerm('');
    };

    const handleUnlinkEquipment = (eqId: string) => {
        const currentLinks = editedItem.linkedEquipmentIds || [];
        setEditedItem({ ...editedItem, linkedEquipmentIds: currentLinks.filter(id => id !== eqId) });
    };

    const handleActivateDraft = () => {
        const activated = { ...editedItem, status: 'Active' as const };
        onUpdate(activated);
        onClose();
    };

    const handleConfirmMerge = async () => {
        if (!confirmingMergeId) return;
        setIsProcessingMerge(true);
        try {
            await onMerge(item.id, confirmingMergeId);
            onClose();
        } catch (error) {
            // Toast handled in store
        } finally {
            setIsProcessingMerge(false);
        }
    };

    const getLinkedEquipment = () => {
        const linkedIds = editedItem.linkedEquipmentIds || [];
        return allEquipment.filter(eq => linkedIds.includes(eq.id));
    };

    const filteredEquipmentForLinking = allEquipment
        .filter(eq => !editedItem.linkedEquipmentIds?.includes(eq.id))
        .filter(eq => normalizeForSearch(eq.name).includes(normalizeForSearch(eqSearchTerm)));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-line">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-txt-3 uppercase">SKU:</label>
                                    <input
                                        type="text"
                                        value={editedItem.sku}
                                        onChange={(e) => setEditedItem({ ...editedItem, sku: e.target.value })}
                                        className="font-mono text-xs bg-surface-2 border border-line rounded px-2 py-1 text-txt-2 focus:ring-2 focus:ring-accent outline-none"
                                    />
                                </div>
                            ) : (
                                <span className="font-mono text-xs bg-surface-2 px-2 py-1 rounded text-txt-2">
                                    {item.sku}
                                </span>
                            )}
                            {item.quantity <= item.minStock && (
                                <span className="flex items-center gap-1 text-xs font-bold text-ko bg-ko-dim px-2 py-1 rounded">
                                    <AlertTriangle size={12} /> Stock Crítico
                                </span>
                            )}
                        </div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedItem.name}
                                onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
                                className="text-2xl font-bold text-txt bg-surface-2 border border-line rounded-lg px-2 py-1 w-full"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-txt leading-tight">
                                {item.name}
                                {item.status === 'Draft' && (
                                    <span className="ml-3 inline-block px-2 py-0.5 rounded text-xs font-bold bg-warn-dim text-warn border border-warn-border uppercase tracking-wider">Borrador</span>
                                )}
                            </h2>
                        )}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2.5 bg-surface-2 text-txt-3 hover:text-txt-2 rounded-xl transition-all active:scale-95 border border-line shadow-sm"
                    >
                        <X size={20} className="sm:size-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-line px-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`pb-3 pt-4 px-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'details'
                            ? 'border-accent text-accent '
                            : 'border-transparent text-txt-2 hover:text-txt-2 '
                            }`}
                    >
                        Detalles
                    </button>
                    <button
                        onClick={() => setActiveTab('suppliers')}
                        className={`pb-3 pt-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'suppliers'
                            ? 'border-accent text-accent '
                            : 'border-transparent text-txt-2 hover:text-txt-2 '
                            }`}
                    >
                        Proveedores
                        {(editedItem.suppliers?.length || 0) > 0 && (
                            <span className="bg-surface-2 text-txt-2 text-xs px-1.5 py-0.5 rounded-full">
                                {editedItem.suppliers?.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('linked')}
                        className={`pb-3 pt-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'linked'
                            ? 'border-accent text-accent '
                            : 'border-transparent text-txt-2 hover:text-txt-2 '
                            }`}
                    >
                        Equipos Vinculados
                        {(editedItem.linkedEquipmentIds?.length || 0) > 0 && (
                            <span className="bg-surface-2 text-txt-2 text-xs px-1.5 py-0.5 rounded-full">
                                {editedItem.linkedEquipmentIds?.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {activeTab === 'details' ? (
                        <>
                            {/* Image Section */}
                            <div className="flex justify-center mb-6">
                                <div className="relative group">
                                    {editedItem.image ? (
                                        <img
                                            src={editedItem.image}
                                            alt={editedItem.name}
                                            className="w-48 h-48 object-cover rounded-xl shadow-md border-4 border-white"
                                        />
                                    ) : (
                                        <div className="w-48 h-48 bg-surface-2 rounded-xl flex flex-col items-center justify-center text-txt-3 border-2 border-dashed border-line-2">
                                            <ImageIcon size={48} className="mb-2 opacity-50" />
                                            <span className="text-xs">Sin imagen</span>
                                        </div>
                                    )}

                                    {isEditing && (
                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-2 bg-surface rounded-full text-txt hover:bg-accent-dim transition-colors"
                                            >
                                                <Upload size={20} />
                                            </button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                            />
                                            {editedItem.image && (
                                                <button
                                                    onClick={() => setEditedItem({ ...editedItem, image: undefined })}
                                                    className="p-2 bg-surface rounded-full text-ko hover:bg-ko-dim transition-colors ml-2"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Main Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor={isEditing ? "inv-location" : undefined} className="text-xs font-semibold text-txt-3 uppercase tracking-wider mb-1 block">Ubicación</label>
                                        {isEditing ? (
                                            <input
                                                id="inv-location"
                                                name="location"
                                                type="text"
                                                value={editedItem.location}
                                                onChange={(e) => setEditedItem({ ...editedItem, location: e.target.value })}
                                                className="w-full text-txt-2 bg-surface-2 p-2 rounded-lg border border-line"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 text-txt-2 bg-surface-2 p-3 rounded-lg border border-line">
                                                <MapPin size={18} className="text-accent" />
                                                <span className="font-medium">{item.location}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor={isEditing ? "inv-manufacturer" : undefined} className="text-xs font-semibold text-txt-3 uppercase tracking-wider mb-1 block">Fabricante / Marca</label>
                                        {isEditing ? (
                                            <input
                                                id="inv-manufacturer"
                                                name="manufacturer"
                                                type="text"
                                                value={editedItem.manufacturer}
                                                onChange={(e) => setEditedItem({ ...editedItem, manufacturer: e.target.value })}
                                                className="w-full text-txt-2 bg-surface-2 p-2 rounded-lg border border-line"
                                                placeholder="Ej. SKF, Siemens..."
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 text-txt-2 bg-surface-2 p-3 rounded-lg border border-line">
                                                <Tag size={18} className="text-txt-3" />
                                                <span className="">{item.manufacturer || 'Sin marca'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor={isEditing ? "inv-supplier" : undefined} className="text-xs font-semibold text-txt-3 uppercase tracking-wider mb-1 block">Proveedor Principal</label>
                                        {isEditing ? (
                                            <input
                                                id="inv-supplier"
                                                name="supplier"
                                                type="text"
                                                value={editedItem.supplier}
                                                onChange={(e) => setEditedItem({ ...editedItem, supplier: e.target.value })}
                                                className="w-full text-txt-2 bg-surface-2 p-2 rounded-lg border border-line"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 text-txt-2 p-2">
                                                <Package size={18} className="text-txt-3" />
                                                <span>{item.supplier}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-txt-3 uppercase tracking-wider mb-1 block">Estado de Stock</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className={`p-3 rounded-lg text-center border ${isEditing ? 'bg-surface-2  border-line' : 'bg-accent-dim  border-accent-border '}`}>
                                                {isEditing ? (
                                                    <input
                                                        aria-label="Cantidad actual"
                                                        type="number"
                                                        value={isNaN(editedItem.quantity) ? '' : editedItem.quantity}
                                                        onChange={(e) => setEditedItem({ ...editedItem, quantity: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                                                        className="text-xl font-bold text-center bg-transparent w-full outline-none"
                                                    />
                                                ) : (
                                                    <div className="text-xl font-bold text-accent">{item.quantity}</div>
                                                )}
                                                <div className="text-xs text-txt-2 font-medium">Actual</div>
                                            </div>
                                            <div className="p-3 bg-surface-2 rounded-lg text-center border border-line">
                                                {isEditing ? (
                                                    <input
                                                        aria-label="Stock mínimo"
                                                        type="number"
                                                        value={isNaN(editedItem.minStock) ? '' : editedItem.minStock}
                                                        onChange={(e) => setEditedItem({ ...editedItem, minStock: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                                                        className="text-xl font-bold text-center bg-transparent w-full outline-none"
                                                    />
                                                ) : (
                                                    <div className="text-xl font-bold text-txt-2">{item.minStock}</div>
                                                )}
                                                <div className="text-xs text-txt-2 font-medium">Mínimo</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-line my-4"></div>

                            {canViewPrice && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-xs text-txt-3 mb-1 block">Precio Unitario</label>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={isNaN(editedItem.price) ? '' : editedItem.price}
                                                onChange={(e) => setEditedItem({ ...editedItem, price: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                                                className="text-lg font-bold bg-surface-2 border border-line rounded px-2 w-full"
                                            />
                                        ) : (
                                            <div className="text-lg font-bold text-txt">{item.price.toFixed(2)} €</div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs text-txt-3 mb-1 block">Valor Total</label>
                                        <div className="text-lg font-bold text-txt">{(editedItem.price * editedItem.quantity).toFixed(2)} €</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs text-txt-3 mb-1 block">Importancia</label>
                                        {isEditing ? (
                                            <select
                                                value={editedItem.critic}
                                                onChange={(e) => setEditedItem({ ...editedItem, critic: e.target.value as any })}
                                                className="text-xs font-bold bg-surface-2 border border-line rounded px-2 py-1 w-full"
                                            >
                                                <option value="Alta">Alta</option>
                                                <option value="Media">Media</option>
                                                <option value="Baja">Baja</option>
                                            </select>
                                        ) : (
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${item.critic === 'Alta' ? 'bg-ko-dim text-ko' :
                                                item.critic === 'Media' ? 'bg-warn-dim text-warn' :
                                                    'bg-ok-dim text-ok'
                                                }`}>
                                                {item.critic}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* QR Code Section */}
                            <div className="bg-surface-2 p-4 rounded-xl flex items-center justify-between border border-line mt-4">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="bg-surface p-2 rounded border border-line">
                                        <QRCodeSVG
                                            id={`qr-code-${item.id}`}
                                            value={editedItem.qrCode || editedItem.sku}
                                            size={48}
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs text-txt-3 font-mono mb-0.5">Código QR</div>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editedItem.qrCode}
                                                onChange={(e) => setEditedItem({ ...editedItem, qrCode: e.target.value })}
                                                className="w-full text-sm font-bold font-mono bg-surface border border-line rounded px-2 py-1 focus:ring-2 focus:ring-accent outline-none"
                                                placeholder="Personalizar QR..."
                                            />
                                        ) : (
                                            <div className="font-mono text-sm font-bold text-txt-2">{item.qrCode || item.sku}</div>
                                        )}
                                    </div>
                                </div>
                                {!isEditing && (
                                    <QRLabel
                                        compact
                                        value={item.qrCode || item.sku}
                                        code={item.sku}
                                        name={item.name}
                                        stock={item.quantity}
                                    />
                                )}
                            </div>
                        </>
                    ) : activeTab === 'suppliers' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-txt">Lista de Proveedores</h3>
                                {isEditing && (
                                    <button
                                        onClick={() => setIsAddingSupplier(true)}
                                        className="text-sm bg-accent-dim text-accent px-3 py-1.5 rounded-lg font-medium hover:bg-accent-dim transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Añadir
                                    </button>
                                )}
                            </div>

                            {isAddingSupplier && (
                                <div className="p-4 bg-surface-2 rounded-lg border border-line animate-fade-in mb-4">
                                    <h4 className="text-sm font-bold text-txt-2 mb-3 block">Nuevo Registro de Compra</h4>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="col-span-2">
                                            <label className="text-xs text-txt-2 mb-1 block">Proveedor</label>
                                            <input className="w-full text-sm p-2 rounded border border-line-2" placeholder="Nombre del proveedor" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                                        </div>
                                        {canViewPrice && (
                                            <div>
                                                <label className="text-xs text-txt-2 mb-1 block">Precio (€)</label>
                                                <input className="w-full text-sm p-2 rounded border border-line-2" type="number" placeholder="0.00" value={isNaN(newSupplier.lastPrice) ? '' : newSupplier.lastPrice} onChange={e => setNewSupplier({ ...newSupplier, lastPrice: e.target.value === '' ? NaN : parseFloat(e.target.value) })} />
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs text-txt-2 mb-1 block">Cantidad</label>
                                            <input className="w-full text-sm p-2 rounded border border-line-2" type="number" placeholder="0" value={isNaN(newSupplier.lastQuantity) ? '' : newSupplier.lastQuantity} onChange={e => setNewSupplier({ ...newSupplier, lastQuantity: e.target.value === '' ? NaN : parseInt(e.target.value) })} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-txt-2 mb-1 block">Fecha</label>
                                            <input className="w-full text-sm p-2 rounded border border-line-2" type="date" value={newSupplier.lastDate} onChange={e => setNewSupplier({ ...newSupplier, lastDate: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setIsAddingSupplier(false)} className="text-xs text-txt-2 hover:text-txt-2 px-3 py-1">Cancelar</button>
                                        <button onClick={handleAddSupplier} className="text-xs bg-accent text-white px-3 py-1 rounded hover:bg-accent-2">Guardar</button>
                                    </div>
                                </div>
                            )}

                            <div className="border border-line rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-surface-2 text-txt-2 font-medium">
                                        <tr>
                                            <th className="p-3">Proveedor</th>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3 text-right">Cantidad</th>
                                            {canViewPrice && <th className="p-3 text-right">Precio</th>}
                                            {isEditing && <th className="p-3 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {(editedItem.suppliers && editedItem.suppliers.length > 0) ? editedItem.suppliers.map((sup) => (
                                            <tr key={sup.id} className="hover:bg-surface-2 transition-colors">
                                                <td className="p-3 font-medium text-txt">{sup.name}</td>
                                                <td className="p-3 text-txt-2">{sup.lastDate}</td>
                                                <td className="p-3 text-right text-txt-2">{sup.lastQuantity}</td>
                                                {canViewPrice && <td className="p-3 text-right font-medium text-txt-2">{sup.lastPrice.toFixed(2)} €</td>}
                                                {isEditing && (
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleRemoveSupplier(sup.id)} className="text-ko hover:text-ko p-1 rounded hover:bg-ko-dim transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={canViewPrice ? 5 : 4} className="p-8 text-center text-txt-3 italic">No hay historial de proveedores registrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-txt">Equipos Donde se Utiliza</h3>
                                {isEditing && (
                                    <button
                                        onClick={() => setIsLinkingEq(true)}
                                        className="text-sm bg-accent-dim text-accent px-3 py-1.5 rounded-lg font-medium hover:bg-accent-dim transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Vincular Equipo
                                    </button>
                                )}
                            </div>

                            {isLinkingEq && (
                                <div className="p-4 bg-surface-2 rounded-lg border border-line animate-fade-in mb-4">
                                    <h4 className="text-sm font-bold text-txt-2 mb-2">Buscar Equipo para Vincular</h4>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={16} />
                                        <input
                                            className="w-full pl-9 pr-4 py-2 text-sm rounded border border-line-2 bg-surface"
                                            placeholder="Buscar por nombre..."
                                            value={eqSearchTerm}
                                            onChange={(e) => setEqSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto space-y-1 border border-line rounded bg-surface">
                                        {filteredEquipmentForLinking.length > 0 ? (
                                            filteredEquipmentForLinking.map(eq => (
                                                <div
                                                    key={eq.id}
                                                    onClick={() => handleLinkEquipment(eq.id)}
                                                    className="p-2 hover:bg-surface-2 cursor-pointer text-sm flex justify-between items-center"
                                                >
                                                    <span>{eq.name}</span>
                                                    <span className="text-xs text-txt-3">{eq.location}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-xs text-txt-3">No se encontraron equipos</div>
                                        )}
                                    </div>
                                    <div className="flex justify-end gap-2 mt-3">
                                        <button onClick={() => setIsLinkingEq(false)} className="text-xs text-txt-2 hover:text-txt-2 px-3 py-1">Cancelar</button>
                                    </div>
                                </div>
                            )}

                            <div className="border border-line rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-surface-2 text-txt-2 font-medium border-b border-line">
                                        <tr>
                                            <th className="p-3">Equipo</th>
                                            <th className="p-3">Ubicación</th>
                                            {isEditing && <th className="p-3 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line bg-surface">
                                        {getLinkedEquipment().length > 0 ? getLinkedEquipment().map(eq => (
                                            <tr key={eq.id} className="hover:bg-surface-2 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-surface-2 rounded-lg text-txt-2">
                                                            <Boxes size={18} />
                                                        </div>
                                                        <span className="font-bold text-txt">{eq.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-txt-2">{eq.location}</td>
                                                {isEditing && (
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => handleUnlinkEquipment(eq.id)}
                                                            className="text-txt-3 hover:text-ko p-1.5 hover:bg-ko-dim rounded transition-colors"
                                                            title="Desvincular"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={isEditing ? 3 : 2} className="p-8 text-center text-txt-3 italic">
                                                    Este artículo no está vinculado a ningún equipo.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Merging Interface */}
                    {isMerging && (
                        <div className="bg-warn-dim border-2 border-warn-border rounded-2xl p-6 space-y-5 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-warn flex items-center gap-2">
                                    <ArrowRightLeft size={20} /> Fusionar Artículo
                                </h3>
                                <button 
                                    onClick={() => { setIsMerging(false); setConfirmingMergeId(null); }}
                                    className="p-1.5 hover:bg-warn-dim rounded-lg text-warn"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {!confirmingMergeId ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-warn">
                                        Selecciona el artículo <strong>original</strong> con el que deseas fusionar este duplicado. 
                                        Todo el historial y stock de <strong>{item.name}</strong> se moverá al artículo que selecciones a continuación.
                                    </p>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={18} />
                                        <input
                                            className="w-full pl-10 pr-4 py-3 bg-surface border border-warn-border rounded-xl focus:ring-2 focus:ring-warn outline-none shadow-sm"
                                            placeholder="Buscar artículo destino por nombre o SKU..."
                                            value={mergeSearchTerm}
                                            onChange={(e) => setMergeSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {mergeSearchTerm.length > 1 ? (
                                            inventory
                                                .filter(i => i.id !== item.id)
                                                .filter(i => 
                                                    normalizeForSearch(i.name).includes(normalizeForSearch(mergeSearchTerm)) || 
                                                    normalizeForSearch(i.sku).includes(normalizeForSearch(mergeSearchTerm))
                                                )
                                                .map(i => (
                                                    <button
                                                        key={i.id}
                                                        onClick={() => setConfirmingMergeId(i.id)}
                                                        className="w-full p-4 bg-surface hover:bg-warn-dim border border-line rounded-xl flex items-center justify-between group transition-all"
                                                    >
                                                        <div className="flex items-center gap-3 text-left">
                                                            <div className="p-2 bg-surface-2 rounded-lg group-hover:bg-warn-dim text-txt-2 group-hover:text-warn transition-colors">
                                                                <Package size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-txt">{i.name}</div>
                                                                <div className="text-xs text-txt-2 font-mono">{i.sku} · {i.manufacturer || 'Sin marca'}</div>
                                                            </div>
                                                        </div>
                                                        <ArrowRight size={18} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                    </button>
                                                ))
                                        ) : (
                                            <div className="text-center py-8 text-txt-3 italic text-sm">
                                                Escribe el nombre o SKU para buscar artículos similares...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-surface p-5 rounded-2xl border-2 border-dashed border-warn-border">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 text-center">
                                                <div className="text-[10px] font-bold text-txt-3 uppercase mb-1">Duplicado</div>
                                                <div className="font-bold text-txt truncate">{item.name}</div>
                                                <div className="text-[10px] font-mono text-txt-2">{item.sku}</div>
                                            </div>
                                            <div className="p-2 bg-warn-dim rounded-full text-warn flex-shrink-0 animate-pulse">
                                                <ArrowRight size={20} />
                                            </div>
                                            <div className="flex-1 text-center">
                                                <div className="text-[10px] font-bold text-warn uppercase mb-1">Destino (Original)</div>
                                                <div className="font-bold text-txt truncate">
                                                    {inventory.find(i => i.id === confirmingMergeId)?.name}
                                                </div>
                                                <div className="text-[10px] font-mono text-txt-2">
                                                    {inventory.find(i => i.id === confirmingMergeId)?.sku}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-ko-dim p-4 rounded-xl border border-ko-border flex items-start gap-3">
                                        <AlertTriangle className="text-ko shrink-0" size={20} />
                                        <p className="text-xs text-ko">
                                            <strong>Acción irreversible:</strong> {item.name} será <strong>eliminado</strong> permanentemente tras migrar sus datos. Asegúrate de que el artículo de destino es el correcto.
                                        </p>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setConfirmingMergeId(null)}
                                            className="flex-1 py-3 px-4 bg-surface border border-line text-txt-2 font-bold rounded-xl hover:bg-surface-2 transition-colors"
                                            disabled={isProcessingMerge}
                                        >
                                            Cambiar Destino
                                        </button>
                                        <button
                                            onClick={handleConfirmMerge}
                                            disabled={isProcessingMerge}
                                            className="flex-[1.5] py-3 px-4 bg-warn hover:bg-warn hover:brightness-110 text-white font-bold rounded-xl shadow-lg shadow-warn/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isProcessingMerge ? (
                                                <>Fusing...</>
                                            ) : (
                                                <>Confirmar y Fusionar</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-line bg-surface-2 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-surface border border-line text-txt-2 font-medium rounded-lg hover:bg-surface-2 transition-colors"
                    >
                        Cerrar
                    </button>

                    {!isEditing && canEdit && item.status === 'Active' && !isMerging && (
                        <button
                            onClick={() => setIsMerging(true)}
                            className="px-4 py-2 text-warn font-bold rounded-lg hover:bg-warn-dim transition-all flex items-center gap-2"
                        >
                            <ArrowRightLeft size={18} />
                            Fusionar
                        </button>
                    )}

                    {isEditing ? (
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-ok text-white font-medium rounded-lg hover:bg-ok shadow-lg shadow-ok/20 transition-all flex items-center gap-2"
                        >
                            <Save size={18} />
                            Guardar Cambios
                        </button>
                    ) : (
                        canEdit && (
                            <div className="flex gap-3">
                                {item.status === 'Draft' && (
                                    <button
                                        onClick={handleActivateDraft}
                                        className="px-4 py-2 bg-warn text-white font-bold rounded-lg hover:bg-warn hover:brightness-110 shadow-lg shadow-warn/20 transition-all flex items-center gap-2"
                                    >
                                        <Boxes size={18} />
                                        Validar y Activar
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent-2 shadow-lg shadow-accent/20 transition-all flex items-center gap-2"
                                >
                                    <Edit2 size={18} />
                                    Editar Artículo
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
