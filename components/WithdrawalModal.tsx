import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Save, AlertTriangle, Package, MinusCircle } from 'lucide-react';
import { Modal } from './ui/Modal';

interface WithdrawalModalProps {
    item: InventoryItem;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number, reason: string) => void;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({ item, onClose, onConfirm }) => {
    const [quantity, setQuantity] = useState<string>('1');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseInt(quantity);

        if (isNaN(qty) || qty <= 0) {
            setError('La cantidad debe ser mayor a 0');
            return;
        }

        if (qty > item.quantity) {
            setError('No hay suficiente stock disponible');
            return;
        }

        onConfirm(item.id, qty, reason);
    };

    return (
        <Modal onClose={onClose} size="md">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400"><MinusCircle size={22} /></div>}
            >
                Retirada de Material
            </Modal.Header>

            <Modal.Body>
                <form id="withdrawal-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* Item Info Summary */}
                    <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-xl flex items-start gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                            <Package size={24} className="text-slate-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{item.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{item.sku}</p>
                            <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 inline-block">
                                Stock Actual: {item.quantity} un.
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Cantidad a retirar
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={item.quantity}
                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-lg"
                                value={quantity}
                                onChange={(e) => {
                                    setQuantity(e.target.value);
                                    setError('');
                                }}
                                onBlur={() => {
                                    if (quantity === '') setQuantity('0');
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Motivo (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ej. Uso en reparación rápida..."
                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}
                    </div>
                </form>
            </Modal.Body>

            <Modal.Footer>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="withdrawal-form"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    Confirmar
                </button>
            </Modal.Footer>
        </Modal>
    );
};
