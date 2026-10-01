import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Equipment } from '../types';
import { Search, QrCode, X, ChevronDown, Check } from 'lucide-react';
import { QRScannerModal } from './QRScannerModal';
import { toast } from 'sonner';
import { normalizeForSearch } from '../utils/searchUtils';

interface EquipmentSelectorProps {
    equipment: Equipment[];
    selectedId: string;
    onSelect: (id: string) => void;
    required?: boolean;
    className?: string;
    placeholder?: string;
    color?: 'blue' | 'purple' | 'green' | 'orange';
    error?: boolean;
}

export const EquipmentSelector: React.FC<EquipmentSelectorProps> = ({
    equipment,
    selectedId,
    onSelect,
    required = false,
    className = '',
    placeholder = 'Buscar equipo...',
    color = 'blue',
    error = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const filteredEquipment = useMemo(() =>
        equipment.filter(eq => {
            const term = normalizeForSearch(searchTerm);
            return normalizeForSearch(eq.name).includes(term) ||
                normalizeForSearch(eq.location).includes(term) ||
                (eq.code && normalizeForSearch(eq.code).includes(term)) ||
                (eq.serialNumber && normalizeForSearch(eq.serialNumber).includes(term));
        }),
        [equipment, searchTerm]
    );

    const selectedEquipment = useMemo(() =>
        equipment.find(eq => eq.id === selectedId),
        [equipment, selectedId]
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleSelect = (id: string) => {
        onSelect(id);
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleQRScan = (code: string) => {
        if (!code) return;

        // Find equipment by QR Code
        const eq = equipment.find(e => e.qrCode === code);
        if (eq) {
            onSelect(eq.id);
            setSearchTerm('');
            setIsQRModalOpen(false);
            toast.success('Equipo encontrado');
        } else {
            toast.error(`Equipo con QR "${code}" no encontrado`);
            setIsQRModalOpen(false);
        }
    };

    const colorMap = {
        blue: {
            ring: 'ring-blue-500',
            itemBg: 'bg-blue-50 dark:bg-blue-900/20',
            itemText: 'text-blue-700 dark:text-blue-300',
            check: 'text-blue-600',
            qrBg: 'bg-blue-100',
            qrColor: 'text-blue-600',
            qrBorder: 'border-blue-500/50',
            btn: 'bg-blue-600 hover:bg-blue-700',
            btnShadow: 'shadow-blue-600/20',
        },
        purple: {
            ring: 'ring-purple-500',
            itemBg: 'bg-purple-50 dark:bg-purple-900/20',
            itemText: 'text-purple-700 dark:text-purple-300',
            check: 'text-purple-600',
            qrBg: 'bg-purple-100',
            qrColor: 'text-purple-600',
            qrBorder: 'border-purple-500/50',
            btn: 'bg-purple-600 hover:bg-purple-700',
            btnShadow: 'shadow-purple-600/20',
        },
        green: {
            ring: 'ring-green-500',
            itemBg: 'bg-green-50 dark:bg-green-900/20',
            itemText: 'text-green-700 dark:text-green-300',
            check: 'text-green-600',
            qrBg: 'bg-green-100',
            qrColor: 'text-green-600',
            qrBorder: 'border-green-500/50',
            btn: 'bg-green-600 hover:bg-green-700',
            btnShadow: 'shadow-green-600/20',
        },
        orange: {
            ring: 'ring-orange-500',
            itemBg: 'bg-orange-50 dark:bg-orange-900/20',
            itemText: 'text-orange-700 dark:text-orange-300',
            check: 'text-orange-600',
            qrBg: 'bg-orange-100',
            qrColor: 'text-orange-600',
            qrBorder: 'border-orange-500/50',
            btn: 'bg-orange-600 hover:bg-orange-700',
            btnShadow: 'shadow-orange-600/20',
        },
    } as const;

    const c = colorMap[color];


    return (
        <div className={`relative ${className}`} ref={wrapperRef}>

            <div className="flex gap-2">
                {/* Search Input / Selector */}
                <div className="relative flex-1">
                    <div
                        className={`
              w-full p-3 pl-9 pr-14 border rounded-xl cursor-pointer bg-white dark:bg-slate-700 text-slate-900 dark:text-white flex items-center
              ${isOpen ? `ring-2 ${c.ring} border-transparent` : error ? 'border-red-500 ring-1 ring-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-300 dark:border-slate-700'}
            `}
                        onClick={() => {
                            setIsOpen(!isOpen);
                        }}
                    >
                        <Search size={16} className="absolute left-3 text-slate-400" />

                        {isOpen ? (
                            <input
                                type="text"
                                className="w-full bg-transparent outline-none h-full"
                                placeholder="Escribe para buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className={`block truncate font-bold text-sm ${!selectedEquipment ? 'text-slate-400 font-normal' : ''}`}>
                                {selectedEquipment ? (selectedEquipment.code ? `[${selectedEquipment.code}] ${selectedEquipment.name}` : selectedEquipment.name) : placeholder}
                            </span>
                        )}

                        <ChevronDown size={14} className="absolute right-3 text-slate-400" />
                    </div>

                    {/* QR Button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsQRModalOpen(true);
                        }}
                        className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Escanear QR"
                    >
                        <QrCode size={16} />
                    </button>

                    {/* Dropdown List */}
                    {isOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 animate-fade-in custom-scrollbar">
                            {filteredEquipment.length > 0 ? (
                                filteredEquipment.map(eq => (
                                    <div
                                        key={eq.id}
                                        className={`
                      p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex justify-between items-center group transition-colors
                      ${eq.id === selectedId ? c.itemBg : ''}
                    `}
                                        onClick={() => handleSelect(eq.id)}
                                    >
                                        <div className="flex flex-col">
                                            <span className={`font-medium ${eq.id === selectedId ? c.itemText : 'text-slate-700 dark:text-slate-200'}`}>
                                                {eq.code ? `[${eq.code}] ` : ''}{eq.name}
                                            </span>
                                            <span className="text-xs text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300">
                                                {eq.location} {eq.serialNumber ? `• SN: ${eq.serialNumber}` : ''}
                                            </span>
                                        </div>
                                        {eq.id === selectedId && <Check size={16} className={c.check} />}
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-slate-400 text-sm">
                                    No se encontraron equipos
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* QR Scanner Modal (Real) */}
            {isQRModalOpen && (
                <QRScannerModal
                    onClose={() => setIsQRModalOpen(false)}
                    onScan={handleQRScan}
                />
            )}
        </div>
    );
};
