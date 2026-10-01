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
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {label}
                </label>
            )}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    w-full flex items-center justify-between border text-left transition-all
                    ${size === 'sm' ? 'px-2 py-1 text-[11px] rounded-md' : 'p-3 text-sm rounded-xl'}
                    ${error ? 'border-red-500 ring-1 ring-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-300 dark:border-slate-700'}
                    ${disabled ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white hover:border-blue-400 dark:hover:border-slate-600'}
                    ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
                `}
            >
                <span className={`block truncate ${!value ? 'text-slate-400' : ''}`}>
                    {selectedLabel}
                </span>
                <ChevronDown
                    size={size === 'sm' ? 14 : 20}
                    className={`ml-2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                            className="lg:hidden fixed inset-0 bg-black/60 z-[9990] flex items-end sm:items-center justify-center backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        >
                            {/* Mobile Drawer/Modal */}
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="w-full sm:w-[500px] max-h-[70vh] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-100 dark:bg-slate-800">
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-gray-100">{label || placeholder}</h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500"
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
                                                w-full flex items-center justify-between px-4 py-4 text-left rounded-xl transition-all
                                                ${value === option.value
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700'}
                                            `}
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
                            className="hidden lg:block absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-auto custom-scrollbar"
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
                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}
                                        `}
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
