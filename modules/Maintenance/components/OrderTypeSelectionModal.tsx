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
                    className="flex flex-col items-center justify-center gap-4 p-6 rounded-xl border-2 border-slate-100 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                >
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Wrench size={32} />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">Correctivo</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Reparar una avería o fallo reportado.</p>
                    </div>
                </button>

                <button
                    onClick={onSelectPreventive}
                    className="flex flex-col items-center justify-center gap-4 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                >
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-full text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                        <RefreshCw size={28} />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">Preventivo</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Crear plan de mantenimiento periódico.</p>
                    </div>
                </button>

                <button
                    onClick={onSelectPlanned}
                    className="flex flex-col items-center justify-center gap-4 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
                >
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-full text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <Calendar size={28} />
                    </div>
                    <div className="text-center">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-1">Actuación</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Actuación programada puntual.</p>
                    </div>
                </button>
            </div>
        </Modal.Body>
    </Modal>
);
