import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    error?: boolean;
    className?: string;
    size?: 'normal' | 'sm';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Seleccionar...',
    label,
    disabled = false,
    error = false,
    className = '',
    size = 'normal'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(opt => opt.value === value)?.label || placeholder;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-txt-2 mb-1">
                    {label}
                </label>
            )}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    fld-input w-full flex items-center justify-between text-left
                    ${size === 'sm' ? 'px-2 py-1 text-[11px] rounded-md' : 'p-3 text-sm rounded-[6px]'}
                    ${error ? 'error' : ''}
                    ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                `}
            >
                <span className={`block truncate ${!value ? 'text-txt-3' : ''}`}>
                    {selectedLabel}
                </span>
                <ChevronDown
                    size={size === 'sm' ? 14 : 20}
                    className={`ml-2 text-txt-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Mobile Overlay (Fixed Backdrop) */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="lg:hidden fixed inset-0 z-[9990] flex items-end sm:items-center justify-center"
                            style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)' }}
                            onClick={() => setIsOpen(false)}
                        >
                            {/* Mobile Drawer/Modal */}
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="w-full sm:w-[500px] max-h-[70vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
                                style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-xl)' }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-4 border-b border-line flex justify-between items-center" style={{ background: 'var(--surface2)' }}>
                                    <h3 className="font-bold text-lg text-txt">{label || placeholder}</h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 rounded-full text-txt-2"
                                        style={{ background: 'var(--surface3)' }}
                                    >
                                        <ChevronDown size={20} className="rotate-180" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto p-2 space-y-1">
                                    {options.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                onChange(option.value);
                                                setIsOpen(false);
                                            }}
                                            className={`
                                                w-full flex items-center justify-between px-4 py-4 text-left rounded-[10px] transition-all border
                                                ${value === option.value
                                                    ? 'text-white'
                                                    : 'text-txt-2 hover:bg-surface-2 border-transparent'}
                                            `}
                                            style={value === option.value
                                                ? { background: 'var(--btn-primary-bg)', borderColor: 'transparent' }
                                                : undefined}
                                        >
                                            <span className="text-lg font-medium">{option.label}</span>
                                            {value === option.value && <Check size={20} className="ml-2 flex-shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        </motion.div>

                        {/* Desktop Dropdown (Absolute) */}
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="hidden lg:block absolute z-50 w-full mt-1 border border-line rounded-[10px] max-h-60 overflow-auto custom-scrollbar"
                            style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}
                        >
                            <div className="py-1">
                                {options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`
                                            w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors
                                            ${value === option.value
                                                ? 'text-accent font-medium'
                                                : 'text-txt-2 hover:bg-surface-2'}
                                        `}
                                        style={value === option.value ? { background: 'var(--accentdim)' } : undefined}
                                    >
                                        <span className="truncate">{option.label}</span>
                                        {value === option.value && <Check size={16} className="ml-2 flex-shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
