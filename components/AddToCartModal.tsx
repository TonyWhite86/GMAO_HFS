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
                icon={<div className="p-2 bg-accent-dim rounded-lg text-accent"><ShoppingCart size={20} /></div>}
            >
                Añadir a la Cesta
            </Modal.Header>

            <Modal.Body>
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-surface-2 rounded-xl flex items-center justify-center mb-4">
                        <ShoppingCart size={32} className="text-accent" />
                    </div>
                    <h2 className="text-lg font-bold text-txt text-center mb-1">{item.name}</h2>
                    <p className="text-sm text-txt-2 text-center mb-6">{item.sku} | Disp: {available} / {item.quantity}</p>

                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={handleDecrement}
                            className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-txt-2 hover:bg-surface-3"
                        >
                            <Minus size={18} />
                        </button>
                        <span className="text-2xl font-bold text-txt w-12 text-center">{quantity}</span>
                        <button
                            onClick={handleIncrement}
                            disabled={quantity >= available}
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-colors ${quantity >= available ? 'bg-surface-3 cursor-not-allowed' : 'bg-accent hover:bg-accent-2'}`}
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    <button
                        onClick={handleAdd}
                        className="w-full py-3 btn btn-primary text-white rounded-xl font-bold shadow-lg shadow-accent/20 transition-all"
                    >
                        Añadir {quantity} unidade(s)
                    </button>
                </div>
            </Modal.Body>
        </Modal>
    );
};
