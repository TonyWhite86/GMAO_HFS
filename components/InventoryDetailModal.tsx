import React, { useState, useRef, useMemo } from 'react';
import { InventoryItem, SupplierInfo, Equipment, User, UserRole } from '../types';
import { X, AlertTriangle, MapPin, Tag, Package, Printer, Save, Edit2, Upload, Trash2, Image as ImageIcon, Plus, DollarSign, Calendar, Boxes, Link2, Search, ArrowRightLeft, ArrowRight } from 'lucide-react';
import { normalizeForSearch } from '../utils/searchUtils';
import { QRCodeSVG } from 'qrcode.react';

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

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const qrSvg = document.getElementById(`qr-code-${item.id}`);
        const qrHtml = qrSvg ? qrSvg.outerHTML : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Etiqueta - ${item.name}</title>
                    <style>
                        body { 
                            font-family: sans-serif; 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            justify-content: center;
                            padding: 20px;
                            text-align: center;
                        }
                        .label-container {
                            border: 2px solid #000;
                            padding: 15px;
                            width: 250px;
                            border-radius: 10px;
                        }
                        .sku { font-family: monospace; font-size: 14px; margin-bottom: 5px; font-weight: bold; }
                        .name { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
                        .qr-container { margin: 10px 0; }
                        .qr-container svg { width: 150px; height: 150px; }
                        .footer { font-size: 10px; color: #666; margin-top: 10px; }
                        @media print {
                            body { padding: 0; }
                            .label-container { border: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        <div class="sku">${item.sku}</div>
                        <div class="name">${item.name}</div>
                        <div class="qr-container">${qrHtml}</div>
                        <div class="footer">GMAO HFS - Sistema de Gestión</div>
                    </div>
                    <script>
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">SKU:</label>
                                    <input
                                        type="text"
                                        value={editedItem.sku}
                                        onChange={(e) => setEditedItem({ ...editedItem, sku: e.target.value })}
                                        className="font-mono text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            ) : (
                                <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-400">
                                    {item.sku}
                                </span>
                            )}
                            {item.quantity <= item.minStock && (
                                <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
                                    <AlertTriangle size={12} /> Stock Crítico
                                </span>
                            )}
                        </div>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedItem.name}
                                onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
                                className="text-2xl font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 w-full"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">
                                {item.name}
                                {item.status === 'Draft' && (
                                    <span className="ml-3 inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider">Borrador</span>
                                )}
                            </h2>
                        )}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                    >
                        <X size={20} className="sm:size-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-700 px-6 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`pb-3 pt-4 px-2 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'details'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                    >
                        Detalles
                    </button>
                    <button
                        onClick={() => setActiveTab('suppliers')}
                        className={`pb-3 pt-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'suppliers'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                    >
                        Proveedores
                        {(editedItem.suppliers?.length || 0) > 0 && (
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
                                {editedItem.suppliers?.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('linked')}
                        className={`pb-3 pt-4 px-2 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'linked'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                            }`}
                    >
                        Equipos Vinculados
                        {(editedItem.linkedEquipmentIds?.length || 0) > 0 && (
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
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
                                            className="w-48 h-48 object-cover rounded-xl shadow-md border-4 border-white dark:border-slate-700"
                                        />
                                    ) : (
                                        <div className="w-48 h-48 bg-slate-100 dark:bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-700">
                                            <ImageIcon size={48} className="mb-2 opacity-50" />
                                            <span className="text-xs">Sin imagen</span>
                                        </div>
                                    )}

                                    {isEditing && (
                                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-2 bg-white rounded-full text-slate-800 hover:bg-blue-50 transition-colors"
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
                                                    className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors ml-2"
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
                                        <label htmlFor={isEditing ? "inv-location" : undefined} className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Ubicación</label>
                                        {isEditing ? (
                                            <input
                                                id="inv-location"
                                                name="location"
                                                type="text"
                                                value={editedItem.location}
                                                onChange={(e) => setEditedItem({ ...editedItem, location: e.target.value })}
                                                className="w-full text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <MapPin size={18} className="text-blue-500" />
                                                <span className="font-medium">{item.location}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor={isEditing ? "inv-manufacturer" : undefined} className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Fabricante / Marca</label>
                                        {isEditing ? (
                                            <input
                                                id="inv-manufacturer"
                                                name="manufacturer"
                                                type="text"
                                                value={editedItem.manufacturer}
                                                onChange={(e) => setEditedItem({ ...editedItem, manufacturer: e.target.value })}
                                                className="w-full text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700"
                                                placeholder="Ej. SKF, Siemens..."
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                                <Tag size={18} className="text-slate-400" />
                                                <span className="">{item.manufacturer || 'Sin marca'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor={isEditing ? "inv-supplier" : undefined} className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Proveedor Principal</label>
                                        {isEditing ? (
                                            <input
                                                id="inv-supplier"
                                                name="supplier"
                                                type="text"
                                                value={editedItem.supplier}
                                                onChange={(e) => setEditedItem({ ...editedItem, supplier: e.target.value })}
                                                className="w-full text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 p-2">
                                                <Package size={18} className="text-slate-400" />
                                                <span>{item.supplier}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Estado de Stock</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className={`p-3 rounded-lg text-center border ${isEditing ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'}`}>
                                                {isEditing ? (
                                                    <input
                                                        aria-label="Cantidad actual"
                                                        type="number"
                                                        value={isNaN(editedItem.quantity) ? '' : editedItem.quantity}
                                                        onChange={(e) => setEditedItem({ ...editedItem, quantity: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                                                        className="text-xl font-bold text-center bg-transparent w-full outline-none"
                                                    />
                                                ) : (
                                                    <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{item.quantity}</div>
                                                )}
                                                <div className="text-xs text-slate-500 font-medium">Actual</div>
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-center border border-slate-100 dark:border-slate-700">
                                                {isEditing ? (
                                                    <input
                                                        aria-label="Stock mínimo"
                                                        type="number"
                                                        value={isNaN(editedItem.minStock) ? '' : editedItem.minStock}
                                                        onChange={(e) => setEditedItem({ ...editedItem, minStock: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                                                        className="text-xl font-bold text-center bg-transparent w-full outline-none"
                                                    />
                                                ) : (
                                                    <div className="text-xl font-bold text-slate-600 dark:text-slate-400">{item.minStock}</div>
                                                )}
                                                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mínimo</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-700 my-4"></div>

                            {canViewPrice && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Precio Unitario</label>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                value={isNaN(editedItem.price) ? '' : editedItem.price}
                                                onChange={(e) => setEditedItem({ ...editedItem, price: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                                                className="text-lg font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 rounded px-2 w-full"
                                            />
                                        ) : (
                                            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{item.price.toFixed(2)} €</div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Valor Total</label>
                                        <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{(editedItem.price * editedItem.quantity).toFixed(2)} €</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs text-slate-400 mb-1 block">Importancia</label>
                                        {isEditing ? (
                                            <select
                                                value={editedItem.critic}
                                                onChange={(e) => setEditedItem({ ...editedItem, critic: e.target.value as any })}
                                                className="text-xs font-bold bg-slate-50 dark:bg-slate-900/50 border border-slate-200 rounded px-2 py-1 w-full"
                                            >
                                                <option value="Alta">Alta</option>
                                                <option value="Media">Media</option>
                                                <option value="Baja">Baja</option>
                                            </select>
                                        ) : (
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${item.critic === 'Alta' ? 'bg-red-100 text-red-700' :
                                                item.critic === 'Media' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                {item.critic}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* QR Code Section */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800 mt-4">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="bg-white p-2 rounded border border-slate-200">
                                        <QRCodeSVG
                                            id={`qr-code-${item.id}`}
                                            value={editedItem.qrCode || editedItem.sku}
                                            size={48}
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs text-slate-400 font-mono mb-0.5">Código QR</div>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editedItem.qrCode}
                                                onChange={(e) => setEditedItem({ ...editedItem, qrCode: e.target.value })}
                                                className="w-full text-sm font-bold font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Personalizar QR..."
                                            />
                                        ) : (
                                            <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{item.qrCode || item.sku}</div>
                                        )}
                                    </div>
                                </div>
                                {!isEditing && (
                                    <button
                                        onClick={handlePrint}
                                        className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Imprimir Etiqueta"
                                    >
                                        <Printer size={20} />
                                    </button>
                                )}
                            </div>
                        </>
                    ) : activeTab === 'suppliers' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">Lista de Proveedores</h3>
                                {isEditing && (
                                    <button
                                        onClick={() => setIsAddingSupplier(true)}
                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Añadir
                                    </button>
                                )}
                            </div>

                            {isAddingSupplier && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700 animate-fade-in mb-4">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 block">Nuevo Registro de Compra</h4>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="col-span-2">
                                            <label className="text-xs text-slate-500 mb-1 block">Proveedor</label>
                                            <input className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-600" placeholder="Nombre del proveedor" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                                        </div>
                                        {canViewPrice && (
                                            <div>
                                                <label className="text-xs text-slate-500 mb-1 block">Precio (€)</label>
                                                <input className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-600" type="number" placeholder="0.00" value={isNaN(newSupplier.lastPrice) ? '' : newSupplier.lastPrice} onChange={e => setNewSupplier({ ...newSupplier, lastPrice: e.target.value === '' ? NaN : parseFloat(e.target.value) })} />
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">Cantidad</label>
                                            <input className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-600" type="number" placeholder="0" value={isNaN(newSupplier.lastQuantity) ? '' : newSupplier.lastQuantity} onChange={e => setNewSupplier({ ...newSupplier, lastQuantity: e.target.value === '' ? NaN : parseInt(e.target.value) })} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-slate-500 mb-1 block">Fecha</label>
                                            <input className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-600" type="date" value={newSupplier.lastDate} onChange={e => setNewSupplier({ ...newSupplier, lastDate: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setIsAddingSupplier(false)} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1">Cancelar</button>
                                        <button onClick={handleAddSupplier} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Guardar</button>
                                    </div>
                                </div>
                            )}

                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                                        <tr>
                                            <th className="p-3">Proveedor</th>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3 text-right">Cantidad</th>
                                            {canViewPrice && <th className="p-3 text-right">Precio</th>}
                                            {isEditing && <th className="p-3 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {(editedItem.suppliers && editedItem.suppliers.length > 0) ? editedItem.suppliers.map((sup) => (
                                            <tr key={sup.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{sup.name}</td>
                                                <td className="p-3 text-slate-500 dark:text-slate-400">{sup.lastDate}</td>
                                                <td className="p-3 text-right text-slate-700 dark:text-slate-300">{sup.lastQuantity}</td>
                                                {canViewPrice && <td className="p-3 text-right font-medium text-slate-700 dark:text-slate-200">{sup.lastPrice.toFixed(2)} €</td>}
                                                {isEditing && (
                                                    <td className="p-3 text-center">
                                                        <button onClick={() => handleRemoveSupplier(sup.id)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={canViewPrice ? 5 : 4} className="p-8 text-center text-slate-400 italic">No hay historial de proveedores registrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">Equipos Donde se Utiliza</h3>
                                {isEditing && (
                                    <button
                                        onClick={() => setIsLinkingEq(true)}
                                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Vincular Equipo
                                    </button>
                                )}
                            </div>

                            {isLinkingEq && (
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700 animate-fade-in mb-4">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Buscar Equipo para Vincular</h4>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            className="w-full pl-9 pr-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                            placeholder="Buscar por nombre..."
                                            value={eqSearchTerm}
                                            onChange={(e) => setEqSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800">
                                        {filteredEquipmentForLinking.length > 0 ? (
                                            filteredEquipmentForLinking.map(eq => (
                                                <div
                                                    key={eq.id}
                                                    onClick={() => handleLinkEquipment(eq.id)}
                                                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm flex justify-between items-center"
                                                >
                                                    <span>{eq.name}</span>
                                                    <span className="text-xs text-slate-400">{eq.location}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-3 text-center text-xs text-slate-400">No se encontraron equipos</div>
                                        )}
                                    </div>
                                    <div className="flex justify-end gap-2 mt-3">
                                        <button onClick={() => setIsLinkingEq(false)} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1">Cancelar</button>
                                    </div>
                                </div>
                            )}

                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="p-3">Equipo</th>
                                            <th className="p-3">Ubicación</th>
                                            {isEditing && <th className="p-3 w-10"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                                        {getLinkedEquipment().length > 0 ? getLinkedEquipment().map(eq => (
                                            <tr key={eq.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500">
                                                            <Boxes size={18} />
                                                        </div>
                                                        <span className="font-bold text-slate-800 dark:text-slate-200">{eq.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-slate-500 dark:text-slate-400">{eq.location}</td>
                                                {isEditing && (
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => handleUnlinkEquipment(eq.id)}
                                                            className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title="Desvincular"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={isEditing ? 3 : 2} className="p-8 text-center text-slate-400 italic">
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
                        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-6 space-y-5 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                    <ArrowRightLeft size={20} /> Fusionar Artículo
                                </h3>
                                <button 
                                    onClick={() => { setIsMerging(false); setConfirmingMergeId(null); }}
                                    className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-400"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {!confirmingMergeId ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-amber-700 dark:text-amber-400/80">
                                        Selecciona el artículo <strong>original</strong> con el que deseas fusionar este duplicado. 
                                        Todo el historial y stock de <strong>{item.name}</strong> se moverá al artículo que selecciones a continuación.
                                    </p>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
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
                                                        className="w-full p-4 bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/40 border border-slate-200 dark:border-amber-900/30 rounded-xl flex items-center justify-between group transition-all"
                                                    >
                                                        <div className="flex items-center gap-3 text-left">
                                                            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg group-hover:bg-amber-100 dark:group-hover:bg-amber-800 text-slate-500 group-hover:text-amber-600 transition-colors">
                                                                <Package size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 dark:text-slate-200">{i.name}</div>
                                                                <div className="text-xs text-slate-500 font-mono">{i.sku} · {i.manufacturer || 'Sin marca'}</div>
                                                            </div>
                                                        </div>
                                                        <ArrowRight size={18} className="text-amber-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                    </button>
                                                ))
                                        ) : (
                                            <div className="text-center py-8 text-slate-400 italic text-sm">
                                                Escribe el nombre o SKU para buscar artículos similares...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-800">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 text-center">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Duplicado</div>
                                                <div className="font-bold text-slate-800 dark:text-white truncate">{item.name}</div>
                                                <div className="text-[10px] font-mono text-slate-500">{item.sku}</div>
                                            </div>
                                            <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full text-amber-600 flex-shrink-0 animate-pulse">
                                                <ArrowRight size={20} />
                                            </div>
                                            <div className="flex-1 text-center">
                                                <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">Destino (Original)</div>
                                                <div className="font-bold text-slate-800 dark:text-white truncate">
                                                    {inventory.find(i => i.id === confirmingMergeId)?.name}
                                                </div>
                                                <div className="text-[10px] font-mono text-slate-500">
                                                    {inventory.find(i => i.id === confirmingMergeId)?.sku}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-3">
                                        <AlertTriangle className="text-red-600 shrink-0" size={20} />
                                        <p className="text-xs text-red-700 dark:text-red-300">
                                            <strong>Acción irreversible:</strong> {item.name} será <strong>eliminado</strong> permanentemente tras migrar sus datos. Asegúrate de que el artículo de destino es el correcto.
                                        </p>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setConfirmingMergeId(null)}
                                            className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                                            disabled={isProcessingMerge}
                                        >
                                            Cambiar Destino
                                        </button>
                                        <button
                                            onClick={handleConfirmMerge}
                                            disabled={isProcessingMerge}
                                            className="flex-[1.5] py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
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
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Cerrar
                    </button>

                    {!isEditing && canEdit && item.status === 'Active' && !isMerging && (
                        <button
                            onClick={() => setIsMerging(true)}
                            className="px-4 py-2 text-amber-600 dark:text-amber-400 font-bold rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all flex items-center gap-2"
                        >
                            <ArrowRightLeft size={18} />
                            Fusionar
                        </button>
                    )}

                    {isEditing ? (
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all flex items-center gap-2"
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
                                        className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2"
                                    >
                                        <Boxes size={18} />
                                        Validar y Activar
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
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
