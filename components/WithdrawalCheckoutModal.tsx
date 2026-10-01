import React, { useState } from 'react';
import { InventoryItem, WorkOrder, WOStatus, User, UserRole } from '../types';
import { ShoppingCart, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { Modal } from './ui/Modal';

interface CartItem {
    item: InventoryItem;
    quantity: number;
}

interface WithdrawalCheckoutModalProps {
    cart: CartItem[];
    workOrders: WorkOrder[];
    onClose: () => void;
    onConfirm: (woId: string | null, reason: string) => void;
    currentUser: User;
}

export const WithdrawalCheckoutModal: React.FC<WithdrawalCheckoutModalProps> = ({ cart, workOrders, onClose, onConfirm, currentUser }) => {
    const [selectedWOId, setSelectedWOId] = useState<string>('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    // Filter logic:
    // 1. Must be active (not COMPLETED)
    // 2. If User is Technician, MUST be assigned to them.
    const activeWOs = workOrders.filter(wo => {
        const isActive = wo.status !== WOStatus.COMPLETED;
        if (!isActive) return false;

        if (currentUser.role === UserRole.TECHNICIAN) {
            return wo.assignedUserId === currentUser.id;
        }
        return true;
    });

    const handleConfirm = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedWOId && !reason.trim()) {
            setError('Debes asignar una Orden de Trabajo o explicar el motivo.');
            return;
        }

        onConfirm(selectedWOId || null, reason);
    };

    const totalItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);

    return (
        <Modal onClose={onClose} size="md">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><ShoppingCart size={22} /></div>}
            >
                Finalizar Retirada
            </Modal.Header>

            <Modal.Body>
                {/* Cart Summary */}
                <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Resumen de Materiales</h3>
                    <div className="space-y-3">
                        {cart.map((entry, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
                                        {entry.quantity}
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-800 dark:text-white">{entry.item.name}</div>
                                        <div className="text-xs text-slate-400">{entry.item.sku}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600 text-right font-bold text-slate-800 dark:text-white">
                        Total: {totalItems} unidades
                    </div>
                </div>

                <form id="checkout-form" onSubmit={handleConfirm} className="space-y-6">
                    {/* Option 1: Work Order */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                            <FileText size={16} /> Asignar a Orden de Trabajo
                        </label>
                        <select
                            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={selectedWOId}
                            onChange={(e) => {
                                setSelectedWOId(e.target.value);
                                if (e.target.value) setError('');
                            }}
                        >
                            <option value="">-- Sin asignar (Requiere motivo) --</option>
                            {activeWOs.map(wo => (
                                <option key={wo.id} value={wo.id}>
                                    {wo.id} - {wo.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Option 2: Reason */}
                    <div className={`transition-all duration-300 ${selectedWOId ? 'opacity-50' : 'opacity-100'}`}>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} /> Motivo (Si no se asigna a OT)
                        </label>
                        <textarea
                            className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none"
                            placeholder={selectedWOId ? "Opcional si ya asignaste una OT..." : "Explica por qué retiras este material..."}
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                if (e.target.value) setError('');
                            }}
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg animate-shake">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    )}
                </form>
            </Modal.Body>

            <Modal.Footer>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="checkout-form"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                    <CheckCircle size={20} />
                    Confirmar Retirada
                </button>
            </Modal.Footer>
        </Modal>
    );
};
