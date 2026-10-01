import React, { useMemo } from 'react';
import { AlertCircle, ArrowRight, Package } from 'lucide-react';
import { InventoryItem } from '../../types';
import { normalizeForSearch } from '../../utils/searchUtils';

interface DuplicateWarningProps {
    name: string;
    manufacturer?: string;
    sku?: string;
    existingItems: InventoryItem[];
}

export const DuplicateWarning: React.FC<DuplicateWarningProps> = ({ name, manufacturer, sku, existingItems }) => {
    const similarItems = useMemo(() => {
        if (!name || name.length < 3) return [];

        const normalizedName = normalizeForSearch(name);
        const normalizedMfr = manufacturer ? normalizeForSearch(manufacturer) : '';
        const normalizedSku = sku ? normalizeForSearch(sku) : '';

        return existingItems.filter(item => {
            // 1. Check exact SKU (already handled in some forms but good to have)
            if (sku && normalizeForSearch(item.sku) === normalizedSku) return true;

            // 2. Check Name Similarity (Substring match)
            const itemName = normalizeForSearch(item.name);
            const isNameSimilar = itemName.includes(normalizedName) || normalizedName.includes(itemName);

            // 3. Check Manufacturer match if both have it
            const itemMfr = item.manufacturer ? normalizeForSearch(item.manufacturer) : '';
            const isMfrMatch = normalizedMfr && itemMfr && (itemMfr.includes(normalizedMfr) || normalizedMfr.includes(itemMfr));

            // If name is very similar and manufacturer matches, it's a high risk duplicate
            if (isNameSimilar && isMfrMatch) return true;
            
            // If name is very similar (long names), also a risk
            if (isNameSimilar && normalizedName.length > 5) return true;

            return false;
        }).slice(0, 3); // Only show top 3
    }, [name, manufacturer, sku, existingItems]);

    if (similarItems.length === 0) return null;

    return (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
                <div className="p-1.5 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-400">
                    <AlertCircle size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
                        ¿Ya existe este artículo?
                    </h4>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mb-3">
                        Hemos encontrado {similarItems.length} {similarItems.length === 1 ? 'artículo que coincide' : 'artículos que coinciden'} con tu búsqueda. Por favor, revísalos para evitar duplicados.
                    </p>

                    <div className="space-y-2">
                        {similarItems.map(item => (
                            <div key={item.id} className="bg-white/60 dark:bg-slate-800/40 p-2 rounded-lg border border-amber-100 dark:border-amber-800/50 flex items-center justify-between group transition-all hover:bg-white dark:hover:bg-slate-900">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500">
                                        <Package size={14} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{item.sku} {item.manufacturer ? `· ${item.manufacturer}` : ''}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Ver artículo <ArrowRight size={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
