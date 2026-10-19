import React from 'react';
import { Wrench, RefreshCw, Calendar } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';

interface OrderTypeSelectionModalProps {
    onClose: () => void;
    onSelectCorrective: () => void;
    onSelectPreventive: () => void;
    onSelectPlanned: () => void;
}

export const OrderTypeSelectionModal: React.FC<OrderTypeSelectionModalProps> = ({
    onClose,
    onSelectCorrective,
    onSelectPreventive,
    onSelectPlanned
}) => (
    <Modal onClose={onClose} size="lg">
        <Modal.Header onClose={onClose}>Selecciona Tipo de Orden</Modal.Header>
        <Modal.Body>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                    onClick={onSelectCorrective}
                    className="flex flex-col items-center justify-center gap-4 p-6 rounded-xl border-2 border-line hover:border-accent hover:bg-accent-dim transition-all group"
                >
                    <div className="p-4 bg-surface-2 rounded-full text-txt-2 group-hover:text-accent group-hover:scale-110 transition-transform">
                        <Wrench size={32} />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-txt mb-1">Correctivo</h3>
                        <p className="text-xs text-txt-2">Reparar una avería o fallo reportado.</p>
                    </div>
                </button>

                <button
                    onClick={onSelectPreventive}
                    className="flex flex-col items-center justify-center gap-4 p-4 rounded-xl border-2 border-line hover:border-accent hover:bg-accent-dim transition-all group"
                >
                    <div className="p-3 bg-surface-2 rounded-full text-txt-2 group-hover:text-accent group-hover:scale-110 transition-transform">
                        <RefreshCw size={28} />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-txt mb-1">Preventivo</h3>
                        <p className="text-xs text-txt-2 text-center">Crear plan de mantenimiento periódico.</p>
                    </div>
                </button>

                <button
                    onClick={onSelectPlanned}
                    className="flex flex-col items-center justify-center gap-4 p-4 rounded-xl border-2 border-line hover:border-accent hover:bg-accent-dim transition-all group"
                >
                    <div className="p-3 bg-surface-2 rounded-full text-txt-2 group-hover:text-accent group-hover:scale-110 transition-transform">
                        <Calendar size={28} />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-txt mb-1">Actuación</h3>
                        <p className="text-xs text-txt-2 text-center">Actuación programada puntual.</p>
                    </div>
                </button>
            </div>
        </Modal.Body>
    </Modal>
);
