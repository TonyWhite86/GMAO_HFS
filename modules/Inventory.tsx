import React, { useMemo, useState, useEffect } from 'react';
import { InventoryItem, Equipment, User, WorkOrder, UserRole, WOStatus } from '../types';
import { toast } from 'sonner';
import { Search, ShoppingCart, AlertTriangle, Package, ChevronLeft, ChevronRight, ListOrdered, CheckCircle, ArrowRightLeft } from 'lucide-react';
import { GenericSkeleton } from '../components/GenericSkeleton';
import { GenericTable } from '../components/GenericTable';
import { InventoryDetailModal } from '../components/InventoryDetailModal';
import { AddToCartModal } from '../components/AddToCartModal';
import { WithdrawalCheckoutModal } from '../components/WithdrawalCheckoutModal';
import { QRScannerModal } from '../components/QRScannerModal';
import { normalizeForSearch } from '../utils/searchUtils';
import { Plus, ListPlus } from 'lucide-react';
import { CreateInventoryModal } from '../components/CreateInventoryModal';
import { PurchaseRequestModal } from '../components/PurchaseRequestModal';
import { PurchaseProcessModal } from '../components/PurchaseProcessModal';
import { PurchaseReceptionModal } from '../components/PurchaseReceptionModal';
import { PurchaseOrdersTable } from '../components/PurchaseOrdersTable';
import { InventoryMovementsTable } from '../components/InventoryMovementsTable';
import { POStatus, PurchaseOrder } from '../types';
import { inventoryService } from '../services/inventoryService';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { ReadOnlyInventoryView } from './Inventory/components/ReadOnlyInventoryView';

export interface InventoryProps {
  initialMode?: 'withdrawal' | null;
  initialTab?: 'requests' | null;
  onModeHandled?: () => void;
}

interface CartItem {
  item: InventoryItem;
  quantity: number;
}

import { useAppStore } from '../store/useAppStore';

export const InventoryModule: React.FC<InventoryProps> = ({
  initialMode,
  initialTab,
  onModeHandled
}) => {
  const {
    inventory: items,
    equipment,
    updateInventory: onUpdateItem,
    currentUser,
    workOrders,
    updateWorkOrder: onUpdateWorkOrder,
    addInventory: onAddItem,
    purchaseOrders,
    addPurchaseOrder,
    updatePurchaseOrder,
    mergeInventoryItems,
    sections
  } = useAppStore();

  if (!currentUser) return <GenericSkeleton />;

  const userPermissions = useAppStore(s => s.userPermissions);
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const inventoryPermission = useMemo(() => {
    if (isAdmin) return 'total' as const;
    const perm = userPermissions.find(p => p.userId === currentUser.id && p.module === 'inventory');
    return perm?.level ?? 'sin_acceso';
  }, [userPermissions, currentUser.id, isAdmin]);
  const canManageInventory = inventoryPermission === 'parcial' || inventoryPermission === 'total';

  if (!canManageInventory) {
    return <ReadOnlyInventoryView items={items} />;
  }

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [addToCartItem, setAddToCartItem] = useState<InventoryItem | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [isWithdrawalMode, setIsWithdrawalMode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'orders' | 'movements' | 'drafts'>('inventory');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // Mobile Menu State
  const [showMobileMenu, setShowMobileMenu] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setShowMobileMenu(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle initial state from navigation
  React.useEffect(() => {
    if (initialMode === 'withdrawal') {
      setIsWithdrawalMode(true);
      onModeHandled?.();
    }
    if (initialTab === 'requests') {
      setActiveTab('requests');
      onModeHandled?.();
    }
  }, [initialMode, initialTab, onModeHandled]);

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Real QR Scan
  const handleQrScan = (code: string) => {
    setSearchTerm(code);
    setIsQRModalOpen(false);
  };

  // --- Cart Logic ---
  const handleAddToCart = (item: InventoryItem, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(p => p.item.id === item.id);
      if (existing) {
        return prev.map(p => p.item.id === item.id ? { ...p, quantity: p.quantity + quantity } : p);
      }
      return [...prev, { item, quantity }];
    });
    setAddToCartItem(null);
  };

  const handleCheckoutConfirm = (woId: string | null, reason: string) => {
    if (woId) {
      const wo = workOrders.find(w => w.id === woId);
      if (wo) {
        const newParts = cart.map(c => ({
          partId: c.item.id,
          quantity: c.quantity
        }));

        const updatedParts = [...(wo.usedParts || []), ...newParts];

        const partNames = cart.map(c => `${c.quantity}x ${c.item.name}`).join(', ');
        const sysComment = {
          id: crypto.randomUUID(),
          userId: 'system',
          userName: 'Sistema',
          text: `Material retirado y asignado: ${partNames}.`,
          createdAt: new Date().toISOString(),
          isSystem: true
        };

        const updatedWO = {
          ...wo,
          usedParts: updatedParts,
          comments: [...(wo.comments || []), sysComment]
        };

        onUpdateWorkOrder(updatedWO);

        cart.forEach(async (c) => {
          try {
            await inventoryService.registerMovement({
              itemId: c.item.id,
              type: 'OUT',
              quantity: c.quantity,
              reason: `Asignado a OT #${wo.id}`,
              userId: currentUser.id
            });
          } catch (e) {
            console.error('Error recording movement', e);
          }
        });
      }
    } else {
      cart.forEach(async (c) => {
        try {
          await inventoryService.registerMovement({
            itemId: c.item.id,
            type: 'OUT',
            quantity: c.quantity,
            reason: reason || 'Retirada Manual',
            userId: currentUser.id
          });
        } catch (e) {
          console.error('Error recording movement', e);
        }
      });
    }

    const updatedInventory = items.map(item => {
      const cartItem = cart.find(c => c.item.id === item.id);
      if (cartItem) {
        return { ...item, quantity: item.quantity - cartItem.quantity };
      }
      return item;
    });
    useAppStore.getState().setInventory(updatedInventory);

    setCart([]);
    setShowCheckout(false);
  };

  // Price Visibility Logic
  const canViewPrice = useMemo(() => {
    return isAdmin || inventoryPermission === 'parcial' || inventoryPermission === 'total';
  }, [isAdmin, inventoryPermission]);

  // --- Columns Definition ---
  const columns = useMemo(() => {
    const cols = [
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
    ];

    // Only show Price if allowed
    if (canViewPrice) {
      cols.push({
        header: "Precio",
        sortKey: "price",
        render: (item: InventoryItem) => (
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {item.price.toFixed(2)} €
          </span>
        )
      } as any);
    }

    return cols;
  }, [canViewPrice]);

  // Mobile Card Renderer
  const renderCard = (item: InventoryItem) => {
    return (
      <div className="bg-white dark:bg-slate-700 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200">
        <div>
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
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Stock Actual:</span>
            <span className={`font-bold ${item.quantity <= item.minStock ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
              {item.quantity} un.
            </span>
          </div>
          {canViewPrice && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Precio:</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{item.price.toFixed(2)} €</span>
            </div>
          )}
        </div>
      </div>
    )
  };
  const handleRowClick = (item: InventoryItem) => {
    if (isWithdrawalMode) {
      setAddToCartItem(item);
    } else {
      setSelectedItem(item);
    }
  };



  const totalCartItems = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  // Mobile Menu View
  if (showMobileMenu && window.innerWidth < 1024) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Inventario</h1>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { setActiveTab('inventory'); setShowMobileMenu(false); }}
            className="bg-white dark:bg-slate-700 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-4 hover:border-blue-500 transition-all aspect-square"
          >
            <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
              <Package size={32} />
            </div>
            <span className="font-bold text-slate-700 dark:text-white">Stock</span>
          </button>

          <button
            onClick={() => { setActiveTab('requests'); setShowMobileMenu(false); }}
            className="bg-white dark:bg-slate-700 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-4 hover:border-amber-500 transition-all aspect-square"
          >
            <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400">
              <ListPlus size={32} />
            </div>
            <span className="font-bold text-slate-700 dark:text-white">Solicitudes</span>
          </button>

          <button
            onClick={() => { setActiveTab('orders'); setShowMobileMenu(false); }}
            className="bg-white dark:bg-slate-700 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-4 hover:border-indigo-500 transition-all aspect-square"
          >
            <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
              <ListOrdered size={32} />
            </div>
            <span className="font-bold text-slate-700 dark:text-white">Pedidos</span>
          </button>

          <button
            onClick={() => { setActiveTab('movements'); setShowMobileMenu(false); }}
            className="bg-white dark:bg-slate-700 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-4 hover:border-purple-500 transition-all aspect-square"
          >
            <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
              <ArrowRightLeft size={32} />
            </div>
            <span className="font-bold text-slate-700 dark:text-white">Movimientos</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-2">
          {/* Mobile Back Button */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {activeTab === 'inventory' && 'Stock e Inventario'}
            {activeTab === 'requests' && 'Solicitudes de Compra'}
            {activeTab === 'orders' && 'Pedidos y Compras'}
            {activeTab === 'movements' && 'Movimientos'}
          </h1>
        </div>

        <div className="flex gap-2">
          {/* Show Cart Button if items in cart */}
          {cart.length > 0 && (
            <button
              onClick={() => setShowCheckout(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
            >
              <ShoppingCart size={18} />
              <span className="font-bold">{totalCartItems} en cesta</span>
            </button>
          )}

          {activeTab === 'inventory' && (
            <button
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/20 ${isWithdrawalMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
              onClick={() => setIsWithdrawalMode(!isWithdrawalMode)}
            >
              {isWithdrawalMode ? <ListOrdered size={18} /> : <ShoppingCart size={18} />}
              <span>{isWithdrawalMode ? 'Salir de Retirada' : 'Modo Retirada'}</span>
            </button>
          )}

          {activeTab === 'inventory' && canManageInventory && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-indigo-600/20"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Añadir Artículo</span>
            </button>
          )}

          {activeTab === 'requests' && (
            <button
              onClick={() => setShowRequestModal(true)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg shadow-lg hover:bg-amber-700 transition-all flex items-center gap-2 shadow-amber-600/20"
            >
              <ListPlus size={18} />
              <span className="">Solicitar Material</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs (Desktop Only) */}
      <div className="hidden lg:flex border-b border-slate-200 dark:border-slate-700 mb-4">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'inventory' ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2">
            <Package size={18} />
            Stock e Inventario
          </div>
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'requests' ? 'border-amber-600 text-amber-600 bg-amber-50/50 dark:bg-amber-900/20' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} />
            Solicitudes
          </div>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'orders' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2">
            <ListOrdered size={18} />
            Pedidos y Compras
          </div>
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'movements' ? 'border-purple-600 text-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          <div className="flex items-center gap-2">
            <ListOrdered size={18} />
            Movimientos
          </div>
        </button>
        {canManageInventory && (
          <button
            onClick={() => setActiveTab('drafts')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'drafts' ? 'border-orange-600 text-orange-600 bg-orange-50/50 dark:bg-orange-900/20' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} />
              Borradores ({items.filter(i => i.status === 'Draft').length})
            </div>
          </button>
        )}
      </div>

      {isWithdrawalMode && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-center gap-3 text-red-800 dark:text-red-300">
          <ShoppingCart className="hidden sm:block" />
          <div>
            <h3 className="font-bold text-sm">Modo Retirada de Material Activo</h3>
            <p className="text-xs opacity-80">Selecciona los repuestos que necesitas para añadirlos a tu cesta. Al finalizar, pulsa en el botón de la cesta para confirmar.</p>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <GenericTable
          data={items.filter(i => i.status !== 'Draft')}
          columns={columns}
          renderCard={renderCard}
          searchFilter={(item, term) =>
            normalizeForSearch(item.name).includes(term) ||
            normalizeForSearch(item.sku).includes(term) ||
            normalizeForSearch(item.qrCode || '').includes(term) ||
            normalizeForSearch(item.manufacturer || '').includes(term)
          }
          emptyMessage="No se encontraron repuestos."
          itemsPerPage={25}
          onRowClick={handleRowClick}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onScan={() => setIsQRModalOpen(true)}
          searchPlaceholder="Buscar por nombre, SKU o fabricante..."
        />
      )}

      {activeTab === 'requests' && (
        <PurchaseOrdersTable
          orders={purchaseOrders.filter(o =>
            o.status === POStatus.REQUESTED
          )}
          onRowClick={(order) => setSelectedOrder(order)}
          currentUser={currentUser}
          inventory={items}
        />
      )}

      {activeTab === 'orders' && (
        <PurchaseOrdersTable
          orders={purchaseOrders.filter(o =>
            o.status !== POStatus.REQUESTED
          )}
          onRowClick={(order) => setSelectedOrder(order)}
          currentUser={currentUser}
          inventory={items}
        />
      )}

      {activeTab === 'movements' && (
        <InventoryMovementsTable currentUser={currentUser} />
      )}

      {activeTab === 'drafts' && (
        <GenericTable
          data={items.filter(i => i.status === 'Draft')}
          columns={columns}
          renderCard={renderCard}
          searchFilter={(item, term) =>
            normalizeForSearch(item.name).includes(term) ||
            normalizeForSearch(item.manufacturer || '').includes(term)
          }
          emptyMessage="No hay borradores pendientes de validar."
          itemsPerPage={25}
          onRowClick={handleRowClick}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar en borradores..."
        />
      )}

      {/* Modals */}
      {selectedItem && (
        <InventoryDetailModal
          item={selectedItem}
          inventory={items}
          allEquipment={equipment}
          onClose={() => setSelectedItem(null)}
          onUpdate={(updatedItem) => {
            onUpdateItem(updatedItem);
            setSelectedItem(updatedItem);
          }}
          onMerge={(delId, keepId) => mergeInventoryItems(keepId, delId)}
          isReadOnly={!canManageInventory}
          currentUser={currentUser}
        />
      )}

      {addToCartItem && (
        <AddToCartModal
          item={addToCartItem}
          alreadyInCart={cart.find(c => c.item.id === addToCartItem.id)?.quantity ?? 0}
          onClose={() => setAddToCartItem(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {showCheckout && (
        <WithdrawalCheckoutModal
          cart={cart}
          workOrders={workOrders}
          onClose={() => setShowCheckout(false)}
          onConfirm={handleCheckoutConfirm}
          currentUser={currentUser}
        />
      )}

      {isQRModalOpen && (
        <QRScannerModal
          onClose={() => setIsQRModalOpen(false)}
          onScan={handleQrScan}
        />
      )}

      {showCreateModal && (
        <CreateInventoryModal
          onClose={() => setShowCreateModal(false)}
          allEquipment={equipment}
          existingItems={items}
          onSubmit={async (item) => {
            try {
              await onAddItem(item);
              setShowCreateModal(false);
            } catch (err) {
              console.error('Error adding inventory item:', err);
            }
          }}
        />
      )}

      {showRequestModal && (
        <PurchaseRequestModal
          onClose={() => setShowRequestModal(false)}
          onAddNewItem={onAddItem}
          onSubmit={async (order, items) => {
            await addPurchaseOrder(order, items);
            setShowRequestModal(false);
          }}
          inventory={items}
          allEquipment={equipment}
          currentUser={currentUser}
        />
      )}

      {selectedOrder && (!isAdmin || selectedOrder.status === POStatus.REQUESTED || selectedOrder.status === POStatus.DRAFT) && (
        <PurchaseProcessModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={async (updated) => {
            await updatePurchaseOrder(updated);
            setSelectedOrder(null);
          }}
          inventory={items}
          allEquipment={equipment}
          currentUser={currentUser}
        />
      )}

      {selectedOrder && isAdmin && (selectedOrder.status === POStatus.ORDERED || selectedOrder.status === POStatus.PARTIAL) && (
        <PurchaseReceptionModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={async (updated, receivedList) => {
            // RPC atómica: acumula received_quantity, decide Recibido Parcial /
            // Recibido, sella received_date y descuenta stock en la misma
            // transacción (antes eran 1 update + N registerMovement sueltos).
            try {
              await purchaseOrderService.receive(
                updated.id,
                receivedList.map(r => ({ itemId: r.itemId, quantity: r.quantity }))
              );
              toast.success('Recepción registrada correctamente');
              // Refresca pedido e inventario desde la BD (la RPC ya movió stock)
              const refreshed = await purchaseOrderService.getAll();
              useAppStore.getState().setPurchaseOrders(refreshed);
              const stock = await inventoryService.getAll();
              useAppStore.getState().setInventory(stock);
            } catch (e) {
              console.error('Error registrando la recepción:', e);
              toast.error('Error al registrar la recepción');
            }
            setSelectedOrder(null);
          }}
          inventory={items}
        />
      )}
    </div>
  );
};