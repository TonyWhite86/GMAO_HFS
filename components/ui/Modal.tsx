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
            <div role="dialog" aria-modal="true" aria-labelledby={headingId} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-1 sm:p-4 animate-in fade-in duration-300">
                <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${SIZE_CLASSES[size]} border border-slate-200 dark:border-slate-800 flex flex-col max-h-[98dvh] sm:max-h-[90vh] overflow-hidden`}>
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
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10">
            <div className="flex items-center gap-3">
                {icon}
                <h2 id={titleId} className="text-xl font-bold text-slate-900 dark:text-white">{children}</h2>
                {subtitle && (
                    <span className={`text-sm px-2 py-1 rounded-lg font-bold uppercase tracking-wider text-[10px] ${subtitleColor || 'bg-slate-100 text-slate-600'}`}>
                        {subtitle}
                    </span>
                )}
            </div>
            <button 
                onClick={onClose} 
                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                aria-label="Cerrar"
            >
                <X size={20} className="sm:size-6" />
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
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex justify-end gap-3 sticky bottom-0 z-10">
            {children}
        </div>
    );
};

// Attach sub-components to main Modal
Modal.Header = Header;
Modal.Body = Body;
Modal.Footer = Footer;
