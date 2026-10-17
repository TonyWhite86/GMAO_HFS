import React from 'react';
import { X } from 'lucide-react';
import { Equipment } from '../../../types';
import { QRLabel } from '../../../components/common/QRLabel';

interface QRDisplayProps {
    equipment: Equipment;
    onClose: () => void;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({ equipment, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative animate-fade-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-txt-3 hover:text-txt-2 transition-colors"
                >
                    <X size={24} />
                </button>

                <h3 className="text-xl font-bold text-txt mb-2">{equipment.name}</h3>
                <p className="text-sm text-txt-2 mb-6 font-mono">{equipment.code || equipment.qrCode}</p>

                <div className="flex justify-center mb-6">
                    <div className="bg-surface p-4 rounded-xl shadow-inner border border-line">
                        <QRLabel
                            value={equipment.qrCode}
                            code={equipment.code || equipment.qrCode}
                            name={equipment.name}
                        />
                    </div>
                </div>

                <p className="text-xs text-txt-3">
                    La etiqueta incluye QR, código y nombre — cópiala como imagen, descárgala en PNG o imprímela.
                </p>
            </div>
        </div>
    );
};
