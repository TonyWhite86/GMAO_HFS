import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../../../types';
import { Package, AlertTriangle } from 'lucide-react';
import { GenericTable } from '../../../components/GenericTable';
import { QRScannerModal } from '../../../components/QRScannerModal';
import { normalizeForSearch } from '../../../utils/searchUtils';

interface ReadOnlyInventoryViewProps {
  items: InventoryItem[];
}

export const ReadOnlyInventoryView: React.FC<ReadOnlyInventoryViewProps> = ({ items }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const handleQrScan = (code: string) => {
    setSearchTerm(code);
    setIsQRModalOpen(false);
  };

  const columns = useMemo(() => [
    {
      header: "SKU",
      sortKey: "sku",
      render: (item: InventoryItem) => (
        <span className="font-mono text-slate-600 dark:text-slate-400 text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
          {item.sku}
        </span>
      )
    },
    {
      header: "Nombre",
      sortKey: "name",
      render: (item: InventoryItem) => (
        <div>
          <div className="font-bold text-slate-800 dark:text-white">{item.name}</div>
          {item.quantity <= item.minStock && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
              <AlertTriangle size={12} /> Stock Bajo
            </div>
          )}
        </div>
      )
    },
    {
      header: "Ubicación",
      accessor: "location" as keyof InventoryItem,
      sortKey: "location"
    },
    {
      header: "Stock",
      sortKey: "quantity",
      render: (item: InventoryItem) => (
        <span className={`font-bold ${item.quantity <= item.minStock ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
          {item.quantity} un.
        </span>
      )
    }
  ], []);

  const renderCard = (item: InventoryItem) => (
    <div className="bg-white dark:bg-slate-700 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{item.sku}</span>
        {item.quantity <= item.minStock && (
          <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">
            <AlertTriangle size={12} /> Stock Bajo
          </span>
        )}
      </div>
      <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{item.name}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{item.location}</p>
      <div className="flex items-center justify-between text-sm pt-3 border-t border-slate-100 dark:border-slate-600">
        <span className="text-slate-500 dark:text-slate-400">Stock:</span>
        <span className={`font-bold ${item.quantity <= item.minStock ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
          {item.quantity} un.
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
          <Package size={20} />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Consulta de Inventario</h1>
      </div>

      <GenericTable
        data={items.filter(i => i.status !== 'Draft')}
        columns={columns}
        renderCard={renderCard}
        searchFilter={(item, term) =>
          normalizeForSearch(item.name).includes(term) ||
          normalizeForSearch(item.sku).includes(term) ||
          normalizeForSearch(item.qrCode || '').includes(term) ||
          normalizeForSearch(item.location || '').includes(term)
        }
        emptyMessage="No se encontraron repuestos."
        itemsPerPage={25}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onScan={() => setIsQRModalOpen(true)}
        searchPlaceholder="Buscar por nombre, SKU, ubicación o código QR..."
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
