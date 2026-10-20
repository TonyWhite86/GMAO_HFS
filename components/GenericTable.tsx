import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search, QrCode } from 'lucide-react';
import { normalizeForSearch } from '../utils/searchUtils';

export interface Column<T> {
    header: string;
    accessor?: keyof T;
    render?: (item: T) => React.ReactNode;
    sortKey?: string;
    className?: string;
    align?: 'left' | 'center' | 'right';
}

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
};

interface GenericTableProps<T> {
    data: T[];
    columns: Column<T>[];
    renderCard: (item: T) => React.ReactNode;
    itemsPerPage?: number;
    searchFilter?: (item: T, searchTerm: string) => boolean;
    onRowClick?: (item: T) => void;
    isLoading?: boolean;
    emptyMessage?: string;
    initialSort?: { key: string; direction: 'asc' | 'desc' };
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
    onScan?: () => void;
    searchPlaceholder?: string;
    sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
    onSort?: (key: string) => void;
}

export function GenericTable<T extends { id: string | number }>({
    data,
    columns,
    renderCard,
    itemsPerPage = 25,
    searchFilter,
    onRowClick,
    isLoading = false,
    emptyMessage = "No se encontraron datos.",
    initialSort,
    searchTerm: externalSearchTerm,
    onSearchChange,
    onScan,
    searchPlaceholder,
    sortConfig: externalSortConfig,
    onSort: externalOnSort
}: GenericTableProps<T>) {
    const [currentPage, setCurrentPage] = useState(1);
    const [internalSearchTerm, setInternalSearchTerm] = useState('');
    const [internalSortConfig, setInternalSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(initialSort || null);

    const sortConfig = externalSortConfig !== undefined ? externalSortConfig : internalSortConfig;
    const isExternallySorted = !!externalOnSort;

    const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;

    const handleSearchChange = (val: string) => {
        if (onSearchChange) {
            onSearchChange(val);
        } else {
            setInternalSearchTerm(val);
        }
    };

    const filteredData = useMemo(() => {
        if (!searchTerm || !searchFilter) return data;
        return data.filter(item => searchFilter(item, normalizeForSearch(searchTerm)));
    }, [data, searchTerm, searchFilter]);

    const sortedData = useMemo(() => {
        if (isExternallySorted) return filteredData;
        if (!sortConfig) return filteredData;

        return [...filteredData].sort((a: any, b: any) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const paginatedData = sortedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, data, sortConfig]);

    const handleSort = (key?: string) => {
        if (!key) return;

        if (externalOnSort) {
            externalOnSort(key);
            return;
        }

        setInternalSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const getSortIcon = (key?: string) => {
        if (!key) return null;
        if (sortConfig?.key !== key) return <ArrowUpDown size={14} className="opacity-30 ml-2" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-2" /> : <ArrowDown size={14} className="ml-2" />;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {searchFilter && (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={20} />
                        <input
                            type="text"
                            placeholder={searchPlaceholder || "Buscar..."}
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="fld-input w-full pl-10 pr-4 py-2 rounded-[6px] outline-none"
                        />
                    </div>
                    {onScan && (
                        <button
                            onClick={onScan}
                            className="btn btn-ghost"
                            title="Escanear Código QR"
                        >
                            <QrCode size={20} />
                        </button>
                    )}
                </div>
            )}

            {/* Tabla escritorio */}
            <div className="hidden md:block rounded-xl border border-line overflow-hidden" style={{ background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
                <div className="overflow-x-auto">
                    <table className="tbl">
                        <thead>
                            <tr>
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        className={`${col.sortKey ? 'cursor-pointer hover:bg-surface-2' : ''} ${col.className || ''} ${ALIGN_CLASS[col.align || 'left']}`}
                                        onClick={() => handleSort(col.sortKey)}
                                    >
                                        <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                            {col.header}
                                            {getSortIcon(col.sortKey)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.length > 0 ? (
                                paginatedData.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => onRowClick && onRowClick(item)}
                                        className={onRowClick ? 'cursor-pointer' : '!cursor-default'}
                                    >
                                        {columns.map((col, colIdx) => (
                                            <td key={colIdx} className={`${col.className || ''} ${ALIGN_CLASS[col.align || 'left']}`}>
                                                {col.render ? col.render(item) : (col.accessor ? String(item[col.accessor]) : '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="p-8 text-center text-txt-2">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tarjetas móvil */}
            <div className="md:hidden space-y-4">
                {paginatedData.length > 0 ? (
                    paginatedData.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => onRowClick && onRowClick(item)}
                            className={onRowClick ? 'cursor-pointer tap-highlight-transparent' : ''}
                        >
                            {renderCard(item)}
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center text-txt-2 card">
                        {emptyMessage}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 py-4">
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="btn btn-ghost btn-icon"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-medium text-txt-2">
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="btn btn-ghost btn-icon"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}
