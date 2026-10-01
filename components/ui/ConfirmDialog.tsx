import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title = 'Confirmar',
    message,
    onConfirm,
    onCancel,
    confirmLabel = 'Eliminar',
    cancelLabel = 'Cancelar',
    variant = 'danger'
}) => {
    return (
        <Modal onClose={onCancel}>
            <Modal.Header onClose={onCancel} icon={<AlertTriangle size={20} />}>
                {title}
            </Modal.Header>
            <Modal.Body>
                <p className="text-slate-600 dark:text-slate-300 text-sm">
                    {message}
                </p>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors ${variant === 'danger'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};
