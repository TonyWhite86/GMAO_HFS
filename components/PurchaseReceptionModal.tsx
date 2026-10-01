import React, { useState } from 'react';
import { Save, Package, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { PurchaseOrder, POStatus, InventoryItem, Equipment, PurchaseOrderItem } from '../types';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';

interface PurchaseReceptionModalProps {
    order: PurchaseOrder;
    onClose: () => void;
    onUpdate: (updated: PurchaseOrder, receivedItems: { itemId: string, partId: string, quantity: number }[]) => void;
    inventory: InventoryItem[];
}

export const PurchaseReceptionModal: React.FC<PurchaseReceptionModalProps> = ({
    order,
    onClose,
    onUpdate,
    inventory
}) => {
    // Track received quantities for this session
    const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>(
        order.items.reduce((acc, item) => ({ ...acc, [item.id]: 0 }), {})
    );

    const handleQtyChange = (itemId: string, qtyStr: string, max: number) => {
        const qty = qtyStr === '' ? NaN : parseInt(qtyStr);
        const val = isNaN(qty) ? NaN : Math.min(Math.max(0, qty), max);
        setReceivedQuantities(prev => ({ ...prev, [itemId]: val }));
    };

    const handleConfirm = () => {
        const receivedList = order.items
            .filter(item => (receivedQuantities[item.id] || 0) > 0)
            .map(item => ({
                itemId: item.id,
                partId: item.partId,
                quantity: isNaN(receivedQuantities[item.id]) ? 0 : receivedQuantities[item.id]
            }));

        if (receivedList.length === 0) {
            toast.error('Indique al menos una cantidad recibida');
            return;
        }

        // Calculate new status
        let allReceived = true;
        const updatedItems = order.items.map(item => {
            const newReceived = (item.receivedQuantity || 0) + (receivedQuantities[item.id] || 0);
            if (newReceived < item.quantity) allReceived = false;
            return { ...item, receivedQuantity: newReceived };
        });

        const newStatus = allReceived ? POStatus.RECEIVED : POStatus.PARTIAL;

        const updatedOrder: PurchaseOrder = {
            ...order,
            status: newStatus,
            receivedDate: allReceived ? new Date().toISOString() : order.receivedDate,
            items: updatedItems
        };

        onUpdate(updatedOrder, receivedList);
        toast.success(allReceived ? 'Pedido completado y stock actualizado' : 'Recepción parcial registrada');
        onClose();
    };

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400"><Package size={22} /></div>}
                subtitle={order.number}
                subtitleColor="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
            >
                Recepción de Material
            </Modal.Header>

            <Modal.Body>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-xl flex items-center gap-3 text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={20} />
                    <p className="text-xs font-medium">Al confirmar, se incrementará automáticamente el stock de cada artículo en el inventario.</p>
                </div>

                <div className="space-y-4">
                    {order.items.map((item) => {
                        const part = inventory.find(p => p.id === item.partId);
                        const pending = item.quantity - (item.receivedQuantity || 0);

                        if (pending <= 0) return null;

                        return (
                            <div key={item.id} className="p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white">{part?.name}</div>
                                        <div className="text-xs text-slate-500 font-mono">{part?.sku}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Estado</div>
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {item.receivedQuantity || 0} / {item.quantity} ud.
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cantidad Recibida Hoy</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                className="w-24 p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-black text-green-600 dark:text-green-400"
                                                value={isNaN(receivedQuantities[item.id]) ? '' : receivedQuantities[item.id]}
                                                onChange={e => handleQtyChange(item.id, e.target.value, pending)}
                                                max={pending}
                                            />
                                            <span className="text-xs text-slate-400 italic">Pendiente: {pending} ud.</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleQtyChange(item.id, pending.toString(), pending)}
                                        className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                    >
                                        Todo <ArrowUpRight size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Modal.Body>

            <Modal.Footer>
                <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium text-sm">
                    Cancelar
                </button>
                <button
                    onClick={handleConfirm}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-lg shadow-green-500/20 transition-all flex items-center gap-2 text-sm"
                >
                    <CheckCircle2 size={18} /> Confirmar Recepción
                </button>
            </Modal.Footer>
        </Modal>
    );
};
