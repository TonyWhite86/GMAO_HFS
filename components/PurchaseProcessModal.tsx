import React, { useState } from 'react';
import { Save, ShoppingCart, Package, Truck, Euro, CheckCircle2 } from 'lucide-react';
import { PurchaseOrder, POStatus, InventoryItem, Equipment, User, UserRole } from '../types';
import { toast } from 'sonner';
import { useAppStore } from '../store/useAppStore';
import { Modal } from './ui/Modal';

interface PurchaseProcessModalProps {
    order: PurchaseOrder;
    onClose: () => void;
    onUpdate: (updated: PurchaseOrder) => void;
    inventory: InventoryItem[];
    allEquipment: Equipment[];
    currentUser: User;
}

export const PurchaseProcessModal: React.FC<PurchaseProcessModalProps> = ({
    order,
    onClose,
    onUpdate,
    inventory,
    allEquipment,
    currentUser
}) => {
    const userPermissions = useAppStore(s => s.userPermissions);
    const currentPermission = userPermissions.find(p => p.userId === currentUser.id && p.module === 'inventory');
    const invLevel = currentUser.role === UserRole.ADMIN ? 'total' : (currentPermission?.level ?? 'sin_acceso');
    const canViewSensibleInfo = invLevel === 'parcial' || invLevel === 'total';

    const [supplier, setSupplier] = useState(order.supplier || '');
    const [notes, setNotes] = useState(order.notes || '');
    const [status, setStatus] = useState<POStatus>(order.status);
    const [expectedDate, setExpectedDate] = useState(order.expectedDate ? order.expectedDate.split('T')[0] : '');

    // Track prices for items (for the warehouse to fill)
    const [itemPrices, setItemPrices] = useState<Record<string, number>>(
        order.items.reduce((acc, item) => ({ ...acc, [item.id]: item.unitPrice }), {})
    );

    const handlePriceChange = (itemId: string, priceStr: string) => {
        const price = priceStr === '' ? NaN : parseFloat(priceStr);
        setItemPrices(prev => ({ ...prev, [itemId]: price }));
    };

    const handleSave = () => {
        if (status === POStatus.ORDERED && !supplier) {
            toast.error('Indique un proveedor para lanzar el pedido');
            return;
        }

        const totalAmount = order.items.reduce((acc, item) => {
            const price = isNaN(itemPrices[item.id]) ? 0 : itemPrices[item.id];
            return acc + price * item.quantity;
        }, 0);

        const updatedOrder: PurchaseOrder = {
            ...order,
            supplier,
            notes,
            status,
            totalAmount,
            orderDate: status === POStatus.ORDERED ? new Date().toISOString() : order.orderDate,
            expectedDate: expectedDate ? new Date(expectedDate).toISOString() : order.expectedDate,
            items: order.items.map(item => ({
                ...item,
                unitPrice: isNaN(itemPrices[item.id]) ? 0 : itemPrices[item.id]
            }))
        };

        onUpdate(updatedOrder);
        toast.success(status === POStatus.ORDERED ? 'Pedido lanzado correctamente' : 'Cambios guardados');
        onClose();
    };

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><ShoppingCart size={22} /></div>}
            >
                Procesar {order.status === POStatus.REQUESTED ? 'Solicitud' : 'Pedido'}
            </Modal.Header>

            <Modal.Body>
                <div className="flex items-center gap-2 -mt-2">
                    <p className="text-xs text-slate-500 font-mono">{order.number}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${order.status === POStatus.REQUESTED ? 'bg-amber-100 text-amber-700' :
                        order.status === POStatus.ORDERED ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                        }`}>
                        {order.status}
                    </span>
                </div>

                {/* Items List with Price Inputs */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Package size={16} /> Material Solicitado
                    </h3>
                    <div className="space-y-2">
                        {order.items.map((item) => {
                            const part = inventory.find(p => p.id === item.partId);
                            const equip = allEquipment.find(e => e.id === item.equipmentId);
                            return (
                                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl items-center">
                                    <div className="sm:col-span-2">
                                        <div className="font-bold text-slate-800 dark:text-white text-sm">{part?.name}</div>
                                        <div className="text-[10px] text-slate-500">
                                            Cant: <b className="text-slate-700 dark:text-slate-300">{item.quantity} ud.</b>
                                            {equip && <span className="ml-2">| Equipo: {equip.name}</span>}
                                        </div>
                                    </div>
                                    {canViewSensibleInfo && (
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Precio Unitario (€)</label>
                                            <div className="relative">
                                                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold"
                                                    value={isNaN(itemPrices[item.id]) ? '' : itemPrices[item.id]}
                                                    onChange={e => handlePriceChange(item.id, e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Status Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Estado del Pedido</label>
                        <select
                            className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold disabled:opacity-75"
                            value={status}
                            onChange={e => setStatus(e.target.value as POStatus)}
                            disabled={!canViewSensibleInfo}
                        >
                            <option value={POStatus.REQUESTED}>Solicitud Pendiente</option>
                            <option value={POStatus.ORDERED}>Lanzar Pedido (Confirmado)</option>
                            <option value={POStatus.CANCELLED}>Cancelar Solicitud</option>
                            <option value={POStatus.PARTIAL}>Recibido Parcial</option>
                            <option value={POStatus.RECEIVED}>Recibido</option>
                        </select>
                    </div>

                    {(canViewSensibleInfo || order.supplier) && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Proveedor</label>
                            <div className="relative">
                                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-sm disabled:opacity-75"
                                    placeholder="Nombre del proveedor..."
                                    value={supplier}
                                    onChange={e => setSupplier(e.target.value)}
                                    disabled={!canViewSensibleInfo}
                                />
                            </div>
                        </div>
                    )}

                    {(canViewSensibleInfo || order.expectedDate) && (status === POStatus.ORDERED || order.expectedDate) && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Fecha Prevista de Llegada</label>
                            <div className="relative">
                                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="date"
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 disabled:opacity-75"
                                    value={expectedDate}
                                    onChange={e => setExpectedDate(e.target.value)}
                                    disabled={!canViewSensibleInfo}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Observaciones de Almacén</label>
                    <textarea
                        className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] text-sm"
                        placeholder="Notas sobre el pedido o la recepción..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>
            </Modal.Body>

            <Modal.Footer>
                {canViewSensibleInfo && (
                    <div className="text-sm mr-auto">
                        <span className="text-slate-500">Total Estimado:</span>
                        <div className="text-xl font-black text-slate-900 dark:text-white">
                            {order.items.reduce((acc, item) => {
                                const price = isNaN(itemPrices[item.id]) ? 0 : itemPrices[item.id];
                                return acc + price * item.quantity;
                            }, 0).toFixed(2)} €
                        </div>
                    </div>
                )}
                <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium text-sm">
                    Cancelar
                </button>
                {canViewSensibleInfo && (
                    <button
                        onClick={handleSave}
                        className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 text-sm ${status === POStatus.ORDERED
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                            : 'bg-slate-700 hover:bg-slate-800 text-white shadow-slate-500/20'
                            }`}
                    >
                        {status === POStatus.ORDERED ? <CheckCircle2 size={18} /> : <Save size={18} />}
                        {status === POStatus.ORDERED ? 'Confirmar y Pedir' : 'Guardar Cambios'}
                    </button>
                )}
            </Modal.Footer>
        </Modal>
    );
};
