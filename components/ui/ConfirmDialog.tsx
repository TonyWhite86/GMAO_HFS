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
        <Modal onClose={onCancel} size="sm">
            <Modal.Header onClose={onCancel} icon={<AlertTriangle size={20} style={{ color: 'var(--amber)' }} />}>
                {title}
            </Modal.Header>
            <Modal.Body>
                <p className="text-txt-2 text-sm">
                    {message}
                </p>
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="btn btn-ghost">
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};
