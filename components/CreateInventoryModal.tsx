import React, { useState, useRef } from 'react';
import { Save, Upload, Trash2, Image as ImageIcon, Box, MapPin, Package, Euro } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { InventoryItem, Equipment, CriticLevel } from '../types';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';
import { FormInput } from './ui/FormInput';
import { FormSelect } from './ui/FormSelect';
import { useFileUpload } from '../hooks/useFileUpload';
import { DuplicateWarning } from './inventory/DuplicateWarning';

interface CreateInventoryModalProps {
    onClose: () => void;
    onSubmit: (item: InventoryItem) => void;
    allEquipment: Equipment[];
    existingItems: InventoryItem[];
}

export const CreateInventoryModal: React.FC<CreateInventoryModalProps> = ({ onClose, onSubmit, existingItems }) => {
    const [skuError, setSkuError] = useState(false);
    const [newItem, setNewItem] = useState<InventoryItem>({
        id: '',
        name: '',
        sku: '',
        manufacturer: '',
        quantity: 0,
        minStock: 5,
        category: 'Repuesto',
        location: '',
        price: 0,
        supplier: '',
        qrCode: `QR-${Math.random().toString(36).substring(7).toUpperCase()}`,
        critic: 'Media',
        status: 'Active',
        linkedEquipmentIds: []
    });

    const { uploadFiles, removeFile, isUploading } = useFileUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCancel = async () => {
        // Cleanup if image was uploaded but not submitted (we can only guess if it's new here, 
        // but since this is CreateModal, any uploaded image is new).
        if (newItem.image && newItem.image.startsWith('http')) {
            await removeFile(newItem.image, 'equipment-photos');
        }
        onClose();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const uploaded = await uploadFiles([file] as any, 'equipment-photos', 'inventory');
                if (uploaded.length > 0) {
                    setNewItem(prev => ({ ...prev, image: uploaded[0].url }));
                }
            } catch (error) {
                // Toast handled in hook
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: Empty fields
        if (!newItem.name || !newItem.sku) {
            toast.error('Nombre y SKU son obligatorios');
            return;
        }

        // Validation: Duplicate SKU
        const isDuplicate = existingItems.some(item =>
            item.sku.toLowerCase().trim() === newItem.sku.toLowerCase().trim()
        );

        if (isDuplicate) {
            setSkuError(true);
            toast.error(`El código SKU "${newItem.sku}" ya está siendo usado por otro artículo.`);
            return;
        }

        const safeItem = {
            ...newItem,
            quantity: isNaN(newItem.quantity) ? 0 : newItem.quantity,
            minStock: isNaN(newItem.minStock) ? 0 : newItem.minStock,
            price: isNaN(newItem.price) ? 0 : newItem.price
        };

        setSkuError(false);
        onSubmit(safeItem);
    };

    return (
        <Modal onClose={handleCancel}>
            <Modal.Header
                onClose={handleCancel}
                icon={<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Box size={24} /></div>}
            >
                Nuevo Artículo de Inventario
            </Modal.Header>

            <Modal.Body>
                <form id="create-inventory-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Image Upload */}
                    <div className="md:col-span-2 flex justify-center">
                        <div className="relative group">
                            {newItem.image ? (
                                <img
                                    src={newItem.image}
                                    alt="Vista previa"
                                    className="w-40 h-40 object-cover rounded-2xl shadow-md border-4 border-white dark:border-slate-800"
                                />
                            ) : (
                                <div className="w-40 h-40 bg-slate-100 dark:bg-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700">
                                    <ImageIcon size={40} className="mb-2 opacity-50" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Sin imagen</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 bg-white rounded-full text-slate-800 hover:bg-blue-50 transition-colors mr-2"
                                >
                                    <Upload size={20} />
                                </button>
                                {newItem.image && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (newItem.image) {
                                                await removeFile(newItem.image, 'equipment-photos');
                                                setNewItem({ ...newItem, image: undefined });
                                            }
                                        }}
                                        className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        </div>
                    </div>

                    {/* Name */}
                    <div className="md:col-span-2 space-y-4">
                        <FormInput
                            label="Nombre del Artículo *"
                            placeholder="Ej. Rodamiento SKF 6205"
                            value={newItem.name}
                            onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                            required
                        />
                        <DuplicateWarning 
                            name={newItem.name} 
                            manufacturer={newItem.manufacturer} 
                            sku={newItem.sku} 
                            existingItems={existingItems} 
                        />
                    </div>

                    {/* SKU */}
                    <div>
                        <FormInput
                            label="Fabricante / Marca"
                            placeholder="Ej. SKF, Siemens, etc."
                            value={newItem.manufacturer}
                            onChange={e => setNewItem({ ...newItem, manufacturer: e.target.value })}
                        />
                    </div>

                    <div>
                        <FormInput
                            label="SKU / Referencia *"
                            placeholder="REF-0000"
                            value={newItem.sku}
                            onChange={e => {
                                setNewItem({ ...newItem, sku: e.target.value });
                                if (skuError) setSkuError(false);
                            }}
                            error={skuError}
                            helperText={skuError ? "Este código ya pertenece a otro artículo" : undefined}
                            required
                            className="font-mono"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <FormSelect
                            label="Categoría"
                            value={newItem.category}
                            onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                            options={[
                                { value: "Repuesto", label: "Repuesto" },
                                { value: "Herramienta", label: "Herramienta" },
                                { value: "Consumible", label: "Consumible" },
                                { value: "EPI", label: "EPI" }
                            ]}
                        />
                    </div>

                    {/* Location */}
                    <div>
                        <FormInput
                            label="Ubicación / Almacén"
                            placeholder="Pasillo A, Estantería 3"
                            value={newItem.location}
                            onChange={e => setNewItem({ ...newItem, location: e.target.value })}
                            icon={<MapPin size={18} />}
                        />
                    </div>

                    {/* Supplier */}
                    <div>
                        <FormInput
                            label="Proveedor Principal"
                            placeholder="Nombre del proveedor"
                            value={newItem.supplier}
                            onChange={e => setNewItem({ ...newItem, supplier: e.target.value })}
                            icon={<Package size={18} />}
                        />
                    </div>

                    {/* Quantity & Min Stock */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput
                            label="Stock Inicial"
                            type="number"
                            value={isNaN(newItem.quantity) ? '' : newItem.quantity}
                            onChange={e => setNewItem({ ...newItem, quantity: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                            className="font-bold"
                        />
                        <FormInput
                            label="Stock Mínimo"
                            type="number"
                            value={isNaN(newItem.minStock) ? '' : newItem.minStock}
                            onChange={e => setNewItem({ ...newItem, minStock: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                            className="font-bold text-red-600 dark:text-red-400"
                        />
                    </div>

                    {/* Price & Critic */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput
                            label="Precio Unitario (€)"
                            type="number"
                            step="0.01"
                            value={isNaN(newItem.price) ? '' : newItem.price}
                            onChange={e => setNewItem({ ...newItem, price: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                            icon={<Euro size={18} />}
                        />
                        <FormSelect
                            label="Criticidad"
                            value={newItem.critic}
                            onChange={e => setNewItem({ ...newItem, critic: e.target.value as CriticLevel })}
                            options={[
                                { value: "Alta", label: "Alta" },
                                { value: "Media", label: "Media" },
                                { value: "Baja", label: "Baja" }
                            ]}
                        />
                    </div>

                    {/* QR Code Section */}
                    <div className="md:col-span-2">
                        <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded border border-slate-200">
                                    <QRCodeSVG
                                        value={newItem.qrCode || newItem.sku || 'N/A'}
                                        size={48}
                                        level="M"
                                    />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400 font-mono mb-0.5">Vista Previa QR</div>
                                    <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{newItem.qrCode || newItem.sku || 'N/A'}</div>
                                </div>
                            </div>
                            <div className="flex-1 ml-6">
                                <FormInput
                                    label="Personalizar Código QR (Opcional)"
                                    placeholder="Ej. QR-ITEM-001"
                                    value={newItem.qrCode}
                                    onChange={e => setNewItem({ ...newItem, qrCode: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </form>
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                    Cancelar
                </button>
                <button
                    form="create-inventory-form"
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                    <Save size={18} /> Crear Artículo
                </button>
            </Modal.Footer>
        </Modal>
    );
};
