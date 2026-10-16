import React, { useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    children: React.ReactNode;
    onClose: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

interface ModalHeaderProps {
    children: React.ReactNode;
    onClose: () => void;
    icon?: React.ReactNode;
    subtitle?: string;
    subtitleColor?: string;
}

interface ModalBodyProps {
    children: React.ReactNode;
    className?: string;
}

interface ModalFooterProps {
    children: React.ReactNode;
}

const ModalContext = React.createContext<string>('');

// 1. Root Modal Component
export const Modal = ({ children, onClose, size = 'xl' }: ModalProps) => {
    const headingId = useId();
    return (
        <ModalContext.Provider value={headingId}>
            <div role="dialog" aria-modal="true" aria-labelledby={headingId} className="modal-bg">
                <div className={`modal !w-full !max-h-[98dvh] sm:!max-h-[90vh] !flex !flex-col ${SIZE_CLASSES[size]}`}>
                    {children}
                </div>
            </div>
        </ModalContext.Provider>
    );
};

// 2. Header Sub-component
const Header = ({ children, onClose, icon, subtitle, subtitleColor }: ModalHeaderProps) => {
    const titleId = React.useContext(ModalContext);
    return (
        <div className="modal-hdr !static !rounded-none">
            <div className="flex items-center gap-3">
                {icon}
                <h2 id={titleId} className="!text-xl font-bold text-txt">{children}</h2>
                {subtitle && (
                    <span className={`bdg !text-[10px] !uppercase !tracking-wider ${subtitleColor || 'bdg-gray'}`}>
                        {subtitle}
                    </span>
                )}
            </div>
            <button
                onClick={onClose}
                className="btn btn-ghost btn-icon"
                aria-label="Cerrar"
            >
                <X size={18} />
            </button>
        </div>
    );
};

// 3. Body Sub-component
const Body = ({ children, className = '' }: ModalBodyProps) => {
    return (
        <div className={`flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 ${className}`}>
            {children}
        </div>
    );
};

// 4. Footer Sub-component
const Footer = ({ children }: ModalFooterProps) => {
    return (
        <div className="p-4 border-t border-line flex justify-end gap-3 sticky bottom-0 z-10" style={{ background: 'var(--surface2)' }}>
            {children}
        </div>
    );
};

// Attach sub-components to main Modal
Modal.Header = Header;
Modal.Body = Body;
Modal.Footer = Footer;
