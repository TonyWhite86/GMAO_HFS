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
        <span className="font-mono text-txt-2 text-xs bg-surface-2 px-2 py-1 rounded">
          {item.sku}
        </span>
      )
    },
    {
      header: "Nombre",
      sortKey: "name",
      render: (item: InventoryItem) => (
        <div>
          <div className="font-bold text-txt">{item.name}</div>
          {item.quantity <= item.minStock && (
            <div className="text-xs text-ko mt-1 flex items-center gap-1">
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
        <span className={`font-bold ${item.quantity <= item.minStock ? 'text-ko' : 'text-txt-2'}`}>
          {item.quantity} un.
        </span>
      )
    }
  ], []);

  const renderCard = (item: InventoryItem) => (
    <div className="bg-surface p-5 rounded-xl border border-line hover:border-accent transition-all duration-200">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono bg-surface-2 px-2 py-1 rounded text-txt-2">{item.sku}</span>
        {item.quantity <= item.minStock && (
          <span className="text-xs font-bold text-ko flex items-center gap-1 bg-ko-dim px-2 py-1 rounded">
            <AlertTriangle size={12} /> Stock Bajo
          </span>
        )}
      </div>
      <h3 className="font-bold text-txt text-lg mb-1">{item.name}</h3>
      <p className="text-sm text-txt-2 mb-4">{item.location}</p>
      <div className="flex items-center justify-between text-sm pt-3 border-t border-line">
        <span className="text-txt-2">Stock:</span>
        <span className={`font-bold ${item.quantity <= item.minStock ? 'text-ko' : 'text-txt-2'}`}>
          {item.quantity} un.
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-accent-dim rounded-lg text-accent">
          <Package size={20} />
        </div>
        <h1 className="text-2xl font-bold text-txt">Consulta de Inventario</h1>
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
