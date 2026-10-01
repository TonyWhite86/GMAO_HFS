import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { ShoppingCart, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './ui/Modal';

interface AddToCartModalProps {
    item: InventoryItem;
    alreadyInCart: number;
    onClose: () => void;
    onAddToCart: (item: InventoryItem, quantity: number) => void;
}

export const AddToCartModal: React.FC<AddToCartModalProps> = ({ item, alreadyInCart, onClose, onAddToCart }) => {
    const available = item.quantity - alreadyInCart;
    const [quantity, setQuantity] = useState(1);

    const handleIncrement = () => {
        if (quantity < available) setQuantity(q => q + 1);
    };

    const handleDecrement = () => {
        if (quantity > 1) setQuantity(q => q - 1);
    };

    const handleAdd = () => {
        if (quantity > available) {
            toast.error(`Stock insuficiente. Disponible: ${available}`);
            return;
        }
        onAddToCart(item, quantity);
        onClose();
    };

    return (
        <Modal onClose={onClose} size="sm">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><ShoppingCart size={20} /></div>}
            >
                Añadir a la Cesta
            </Modal.Header>

            <Modal.Body>
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mb-4">
                        <ShoppingCart size={32} className="text-blue-500" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white text-center mb-1">{item.name}</h2>
                    <p className="text-sm text-slate-500 text-center mb-6">{item.sku} | Disp: {available} / {item.quantity}</p>

                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={handleDecrement}
                            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        >
                            <Minus size={18} />
                        </button>
                        <span className="text-2xl font-bold text-slate-800 dark:text-white w-12 text-center">{quantity}</span>
                        <button
                            onClick={handleIncrement}
                            disabled={quantity >= available}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${quantity >= available ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <button
                        onClick={handleAdd}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all"
                    >
                        Añadir {quantity} unidade(s)
                    </button>
                </div>
            </Modal.Body>
        </Modal>
    );
};
