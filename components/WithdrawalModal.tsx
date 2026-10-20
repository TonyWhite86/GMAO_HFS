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
                icon={<div className="p-2 bg-ko-dim rounded-lg text-ko"><MinusCircle size={22} /></div>}
            >
                Retirada de Material
            </Modal.Header>

            <Modal.Body>
                <form id="withdrawal-form" onSubmit={handleSubmit} className="space-y-6">
                    {/* Item Info Summary */}
                    <div className="bg-surface-2 p-4 rounded-xl flex items-start gap-4">
                        <div className="w-12 h-12 bg-surface rounded-lg flex items-center justify-center border border-line shrink-0">
                            <Package size={24} className="text-txt-3" />
                        </div>
                        <div>
                            <h3 className="font-bold text-txt">{item.name}</h3>
                            <p className="text-sm text-txt-2 mb-1">{item.sku}</p>
                            <div className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-dim text-accent inline-block">
                                Stock Actual: {item.quantity} un.
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">
                                Cantidad a retirar
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={item.quantity}
                                className="w-full p-3 bg-surface border border-line rounded-xl focus:ring-2 focus:ring-accent outline-none transition-all font-bold text-lg"
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
                            <label className="block text-sm font-medium text-txt-2 mb-1">
                                Motivo (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ej. Uso en reparación rápida..."
                                className="w-full p-3 bg-surface border border-line rounded-xl focus:ring-2 focus:ring-accent outline-none transition-all"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-sm text-ko bg-ko-dim p-3 rounded-lg">
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
                    className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-txt-2 rounded-xl font-medium transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="withdrawal-form"
                    className="px-6 py-2 btn btn-primary text-white rounded-xl font-bold transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                >
                    <Save size={18} />
                    Confirmar
                </button>
            </Modal.Footer>
        </Modal>
    );
};
