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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {searchFilter && (
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder={searchPlaceholder || "Buscar..."}
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        />
                    </div>
                    {onScan && (
                        <button
                            onClick={onScan}
                            className="p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                            title="Escanear Código QR"
                        >
                            <QrCode size={20} />
                        </button>
                    )}
                </div>
            )}

            <div className="hidden md:block bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th
                                        key={idx}
                                        className={`p-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none ${col.sortKey ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''} ${col.className || ''} text-${col.align || 'left'}`}
                                        onClick={() => handleSort(col.sortKey)}
                                    >
                                        <div className={`flex items-center ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                            {col.header}
                                            {getSortIcon(col.sortKey)}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {paginatedData.length > 0 ? (
                                paginatedData.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => onRowClick && onRowClick(item)}
                                        className={`hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                    >
                                        {columns.map((col, colIdx) => (
                                            <td key={colIdx} className={`p-4 text-sm text-slate-600 dark:text-slate-300 ${col.className || ''} text-${col.align || 'left'}`}>
                                                {col.render ? col.render(item) : (col.accessor ? String(item[col.accessor]) : '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="p-8 text-center text-slate-500 dark:text-slate-400">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700">
                        {emptyMessage}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 py-4">
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 shadow-sm transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Página {currentPage} de {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 shadow-sm transition-all"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}
