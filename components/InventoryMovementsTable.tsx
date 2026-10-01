import React, { useState, useEffect, useMemo } from 'react';
import { InventoryMovement, User } from '../types';
import { inventoryService } from '../services/inventoryService';
import { GenericTable } from './GenericTable';
import { Package, ArrowRight, ArrowLeft, Calendar, Filter } from 'lucide-react';

import { toast } from 'sonner';
import { QRScannerModal } from './QRScannerModal';
import { normalizeForSearch } from '../utils/searchUtils';

interface InventoryMovementsTableProps {
    currentUser: User;
}

export const InventoryMovementsTable: React.FC<InventoryMovementsTableProps> = ({ currentUser }) => {
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Filters
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);


    // Search and QR State
    const [searchTerm, setSearchTerm] = useState('');
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);

    const handleQrScan = (code: string) => {
        setSearchTerm(code);
        setIsQRModalOpen(false);
        toast.success(`Código escaneado: ${code}`);
    };
    const fetchMovements = async () => {
        setIsLoading(true);
        try {
            // Apply date range
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0); // Start of day

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // End of day

            const data = await inventoryService.getMovements({
                type: typeFilter === 'ALL' ? undefined : typeFilter,
                startDate: start.toISOString(),
                endDate: end.toISOString()
            });
            setMovements(data);
        } catch (error) {
            console.error('Error fetching movements:', error);
            toast.error('Error cargando movimientos');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMovements();
    }, [typeFilter, startDate, endDate]);

    const columns = useMemo(() => [
        {
            header: "Artículo",
            accessor: "itemName" as keyof InventoryMovement,
            render: (m: InventoryMovement) => (
                <div>
                    <div className="font-medium text-slate-900 dark:text-white">{m.itemName || 'Desconocido'}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{m.itemSku || '---'}</div>
                </div>
            )
        },
        {
            header: "Tipo",
            accessor: "type" as keyof InventoryMovement,
            render: (m: InventoryMovement) => (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${m.type === 'IN'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                    {m.type === 'IN' ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
                    {m.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                </span>
            )
        },
        {
            header: "Cantidad",
            accessor: "quantity" as keyof InventoryMovement,
            render: (m: InventoryMovement) => (
                <span className={`font-mono font-bold ${m.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {m.type === 'IN' ? '+' : '-'}{m.quantity}
                </span>
            )
        },
        {
            header: "Razón / Origen",
            accessor: "reason" as keyof InventoryMovement,
            render: (m: InventoryMovement) => (
                <span className="text-sm text-slate-600 dark:text-slate-300 italic">
                    {m.reason || 'S/R'}
                </span>
            )
        },
        {
            header: "Usuario",
            accessor: "userName" as keyof InventoryMovement,
            render: (m: InventoryMovement) => (
                <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                    {m.userName || 'Sistema'}
                </span>
            )
        },
        {
            header: "Fecha",
            accessor: "createdAt" as keyof InventoryMovement,
            render: (m: InventoryMovement) => (
                <span className="text-xs text-slate-500">
                    {new Date(m.createdAt).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit'
                    })}
                </span>
            )
        }
    ], []);

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <button
                        onClick={() => setTypeFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'ALL'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setTypeFilter('IN')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'IN'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                    >
                        Entradas
                    </button>
                    <button
                        onClick={() => setTypeFilter('OUT')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'OUT'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                    >
                        Salidas
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:flex sm:items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-40">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-full transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-center">
                        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider px-2">hasta</span>
                    </div>
                    <div className="relative w-full sm:w-40">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-full transition-all"
                        />
                    </div>
                </div>
            </div>

            <GenericTable
                data={movements}
                columns={columns}
                isLoading={isLoading}
                itemsPerPage={20}
                emptyMessage="No hay movimientos en el periodo seleccionado"
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onScan={() => setIsQRModalOpen(true)}
                searchFilter={(item, term) =>
                    normalizeForSearch(item.itemName || '').includes(term) ||
                    normalizeForSearch(item.itemSku || '').includes(term) ||
                    normalizeForSearch(item.reason || '').includes(term)
                }
                searchPlaceholder="Buscar por artículo, SKU o motivo..."
                renderCard={(m) => (
                    <div className="bg-white dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`p-1 rounded-full ${m.type === 'IN' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {m.type === 'IN' ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white">{m.itemName}</span>
                            </div>
                            <div className="text-xs text-slate-500 mb-1">{m.reason || 'Sin motivo'}</div>
                            <div className="text-[10px] text-slate-400 flex gap-2">
                                <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{m.userName}</span>
                            </div>
                        </div>
                        <div className={`text-lg font-mono font-bold ${m.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                            {m.type === 'IN' ? '+' : '-'}{m.quantity}
                        </div>
                    </div>
                )}
            />

            {isQRModalOpen && (
                <QRScannerModal
                    onClose={() => setIsQRModalOpen(false)}
                    onScan={handleQrScan}
                />
            )}
        </div>
    );
};
