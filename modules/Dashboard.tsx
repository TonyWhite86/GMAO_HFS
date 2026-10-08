import React, { useState } from 'react';
import { WorkOrder, InventoryItem, User, WOStatus, WOPriority, UserRole, Equipment, PreventivePlan, POStatus } from '../types';
import { motion } from 'framer-motion';
import { LayoutDashboard, AlertCircle, Clock, CheckCircle, Users, BarChart3, ArrowRight, Package, AlertTriangle, PlayCircle, Plus, Calendar, Wrench, Search, Box, ShoppingCart } from 'lucide-react';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { WorkOrderCard } from '../components/workOrder/WorkOrderCard';
import { QuickCompleteModal } from '../components/workOrder/QuickCompleteModal';
import { QuickStatusModal } from '../components/workOrder/QuickStatusModal';

export interface DashboardProps {
  onNavigate: (module: string) => void;
  onNavigateWithFilter: (module: string, filters: { status?: WOStatus[], unassigned?: boolean, priority?: WOPriority[], section?: string[] }) => void;
  onCreateWorkOrder: () => void;
  onRequestWithdrawal: () => void;
  onRequestPurchase: () => void;
}

// Consistent Status Colors Helper (Same as Maintenance.tsx)
const getStatusColor = (status: WOStatus) => {
  switch (status) {
    case WOStatus.COMPLETED: return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
    case WOStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case WOStatus.SCHEDULED: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    case WOStatus.PENDING: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
    default: return 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-600';
  }
};

const getPriorityIcon = (priority: WOPriority) => {
  switch (priority) {
    case WOPriority.CRITICAL:
    case WOPriority.HIGH:
      return <AlertTriangle size={14} />;
    default:
      return <Clock size={14} />;
  }
};

const getPriorityStyles = (priority: WOPriority) => {
  switch (priority) {
    case WOPriority.CRITICAL:
      return 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 shadow-sm shadow-red-500/10';
    case WOPriority.HIGH:
      return 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 shadow-sm shadow-amber-500/10';
    case WOPriority.MEDIUM:
      return 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 shadow-sm shadow-blue-500/10';
    case WOPriority.LOW:
    default:
      return 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/20 dark:to-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm shadow-slate-500/5';
  }
};

import { useAppStore } from '../store/useAppStore';

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate, onNavigateWithFilter, onCreateWorkOrder, onRequestWithdrawal, onRequestPurchase
}) => {
  const {
    workOrders,
    inventory,
    users,
    currentUser,
    equipment,
    preventivePlans,
    sections,
    updateWorkOrder: onUpdateWorkOrder,
    addWorkOrder: onAddWorkOrder,
    updateInventory: onUpdateInventory,
    purchaseOrders
  } = useAppStore();

  const isInWarehouse = currentUser && currentUser.sections.some(s =>
    s.toLowerCase().includes('almacen') ||
    s.toLowerCase().includes('almacén') ||
    s.toLowerCase().includes('logistica') ||
    s.toLowerCase().includes('logística')
  );

  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  // Find the actual work order object from the store to ensure we have the latest realtime data
  const selectedWorkOrder = workOrders.find(wo => wo.id === selectedWorkOrderId) || null;

  // KPI Calculations
  const activeWOs = workOrders.filter(wo => wo.status === WOStatus.IN_PROGRESS || wo.status === WOStatus.PENDING);
  const unassignedWOs = workOrders.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED);
  const criticalWOs = workOrders.filter(wo => (wo.priority === WOPriority.CRITICAL || wo.priority === WOPriority.HIGH) && wo.status !== WOStatus.COMPLETED);
  const lowStockItems = inventory.filter(item => item.quantity <= item.minStock);
  const pendingRequests = purchaseOrders.filter(po => po.status === POStatus.REQUESTED);

  const totalOpenWOs = workOrders.filter(wo => wo.status !== WOStatus.COMPLETED);

  // Group by Section logic
  const sectionStats = workOrders.reduce((acc: Record<string, number>, wo) => {
    if (wo.status === WOStatus.COMPLETED) return acc;
    const currentCount = acc[wo.section] || 0;
    acc[wo.section] = currentCount + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedSections = Object.entries(sectionStats)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, 5); // Top 5 sections

  // --- Technician Layout ---
  if (currentUser.role === UserRole.TECHNICIAN) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Calculate Tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const myAssignedWOs = workOrders.filter(wo => {
      if (wo.assignedUserId !== currentUser.id || wo.status === WOStatus.COMPLETED) return false;

      // Normalize dates to YYYY-MM-DD for accurate comparison (ignoring time)
      const scheduledIso = wo.scheduledDate || wo.createdAt;
      const scheduledYMD = scheduledIso.split('T')[0];

      return scheduledYMD <= todayStr;
    });

    const myTomorrowWOs = workOrders.filter(wo => {
      if (wo.assignedUserId !== currentUser.id || wo.status === WOStatus.COMPLETED) return false;

      const scheduledIso = wo.scheduledDate || wo.createdAt;
      const scheduledYMD = scheduledIso.split('T')[0];

      return scheduledYMD === tomorrowStr;
    });

    const [completingWO, setCompletingWO] = useState<WorkOrder | null>(null);
    const [statusActionWO, setStatusActionWO] = useState<{ wo: WorkOrder; nextStatus: WOStatus } | null>(null);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Hola, {currentUser.name.split(' ')[0]}</h1>
            <p className="text-slate-500 dark:text-slate-400">Tienes <span className="font-bold text-slate-800 dark:text-white">{myAssignedWOs.length}</span> trabajos pendientes para hoy.</p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={onRequestWithdrawal}
            className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-2 rounded-lg group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
            <span className="font-medium text-sm">Retirar Material</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Assigned Tasks List */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2 px-1">
              <Wrench size={20} className="text-blue-500" />
              Trabajos Prioritarios para Hoy
            </h3>

            <div>
              {myAssignedWOs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                  {myAssignedWOs.map(wo => (
                    <WorkOrderCard
                      key={wo.id}
                      wo={wo}
                      equipment={equipment}
                      users={users}
                      onClick={() => setSelectedWorkOrderId(wo.id)}
                      onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                      onComplete={(wo) => setCompletingWO(wo)}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                  <CheckCircle size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg font-medium">¡Todo al día!</p>
                  <p>No tienes tareas asignadas retrasadas o para realizar hoy.</p>
                </div>
              )}
            </div>
          </div>

          {/* Tomorrow's Tasks List */}
          {myTomorrowWOs.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2 px-1 opacity-75">
                <Calendar size={20} className="text-purple-500" />
                Trabajos para Mañana
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                {myTomorrowWOs.map(wo => (
                  <WorkOrderCard
                    key={wo.id}
                    wo={wo}
                    equipment={equipment}
                    users={users}
                    onClick={() => setSelectedWorkOrderId(wo.id)}
                    onStatusAction={(wo, nextStatus) => setStatusActionWO({ wo, nextStatus })}
                    onComplete={(wo) => setCompletingWO(wo)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status Confirmation Modal */}
        {statusActionWO && (
          <QuickStatusModal
            workOrder={statusActionWO.wo}
            nextStatus={statusActionWO.nextStatus}
            onClose={() => setStatusActionWO(null)}
            onConfirm={() => {
              // El cambio de estado ya lo hizo transition_work_order (RPC):
              // no se vuelve a escribir la OT, sólo se cierra el modal.
              setStatusActionWO(null);
            }}
            currentUser={currentUser}
          />
        )}

        {/* Modal for Details */}
        {selectedWorkOrder && (
          <WorkOrderDetailModal
            workOrder={selectedWorkOrder}
            onClose={() => setSelectedWorkOrderId(null)}
            onUpdate={(updated, shouldClose) => {
              onUpdateWorkOrder(updated);
              if (shouldClose !== false) {
                setSelectedWorkOrderId(null);
              }
            }}
            onAddWorkOrder={onAddWorkOrder}
            preventivePlans={preventivePlans}
            currentUser={currentUser}
            users={users}
            equipment={equipment}
            existingWorkOrders={workOrders}
            sections={sections}
            inventory={inventory}
            onUpdateInventory={onUpdateInventory}
          />
        )}

        {/* Quick Complete Modal */}
        {completingWO && (
          <QuickCompleteModal
            workOrder={completingWO}
            onClose={() => setCompletingWO(null)}
            onConfirm={(updated) => {
              onUpdateWorkOrder(updated);
              setCompletingWO(null);
            }}
            inventory={inventory}
            currentUser={currentUser}
          />
        )}
      </div>
    );
  }

  // --- Warehouse & Logistics Layout ---
  if (isInWarehouse) {
    const totalItems = inventory.length;
    const totalInvestment = inventory.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const criticalStock = inventory.filter(item => item.quantity <= item.minStock / 2).length;

    // Get Recent Withdrawals
    const recentWithdrawals = workOrders
      .filter(wo => (wo.usedParts || []).length > 0)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .flatMap(wo => (wo.usedParts || []).map(p => ({
        part: inventory.find(i => i.id === p.partId),
        quantity: p.quantity,
        date: wo.closedAt || wo.createdAt,
        woId: wo.id,
        equipment: equipment.find(e => e.id === wo.equipmentId)?.name || 'N/A'
      })))
      .slice(0, 8);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Panel de Almacén</h1>
            <p className="text-slate-500 dark:text-slate-400">Control de repuestos y suministros.</p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm font-medium">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Warehouse KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Artículos Totales"
            value={totalItems}
            icon={Box}
            color="blue"
            onClick={() => onNavigate('inventory')}
          />
          <KpiCard
            title="Alertas de Stock"
            value={lowStockItems.length}
            icon={AlertTriangle}
            color="amber"
            onClick={() => onNavigate('inventory')}
          />
          <KpiCard
            title="Suministro Crítico"
            value={criticalStock}
            icon={AlertCircle}
            color="red"
            onClick={() => onNavigate('inventory')}
          />
          <KpiCard
            title="Valor Inventario"
            value={Math.round(totalInvestment)}
            icon={BarChart3}
            color="purple"
            suffix=" €"
            onClick={() => onNavigate('reports')}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => {
              onNavigate('inventory');
              // We'd need to pass a "showCreateModal" prop or trigger it via store if needed.
              // For now, navigating to inventory is the primary action.
            }}
            className="flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all active:scale-95 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-lg group-hover:rotate-12 transition-transform">
                <Plus size={24} />
              </div>
              <div className="text-left">
                <span className="block font-bold">Añadir Artículo</span>
                <span className="text-xs text-indigo-100">Registrar nuevo repuesto en el sistema</span>
              </div>
            </div>
            <ArrowRight size={20} className="opacity-50" />
          </button>

          <button
            onClick={onRequestWithdrawal}
            className="flex items-center justify-between p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg transition-all active:scale-95 group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-lg group-hover:rotate-12 transition-transform">
                <ShoppingCart size={24} />
              </div>
              <div className="text-left">
                <span className="block font-bold">Modo Retirada</span>
                <span className="text-xs text-emerald-100">Sacar material del inventario</span>
              </div>
            </div>
            <ArrowRight size={20} className="opacity-50" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Withdrawals (Consumption) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-6">Consumos Recientes</h3>
            <div className="space-y-4">
              {recentWithdrawals.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500 dark:text-slate-400">
                      <Package size={18} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-200">{item.part?.name || 'Repuesto desconocido'}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.equipment} • {new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      -{item.quantity} un.
                    </span>
                  </div>
                </div>
              ))}
              {recentWithdrawals.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  No hay registros de consumo recientes.
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Watchlist */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500" />
              Alerta de Reposición
            </h3>
            <div className="flex-1 space-y-4">
              {lowStockItems.slice(0, 10).map(item => (
                <div key={item.id} className="flex justify-between items-center group cursor-pointer" onClick={() => onNavigate('inventory')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo: {item.minStock} un.</p>
                  </div>
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-bold ${item.quantity <= item.minStock / 2 ? 'text-red-500' : 'text-amber-500'}`}>
                      {item.quantity} un.
                    </span>
                  </div>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
                  <CheckCircle size={40} className="text-green-500/50" />
                  <p className="text-sm">Stock bajo control</p>
                </div>
              )}
            </div>
            {lowStockItems.length > 10 && (
              <button
                onClick={() => onNavigate('inventory')}
                className="mt-4 w-full py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                VER TODOS ({lowStockItems.length})
              </button>
            )}
          </div>

          {/* Pending Requests Mini-List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
              <ShoppingCart size={20} className="text-amber-500" />
              Solicitudes Pendientes
            </h3>
            <div className="flex-1 space-y-4">
              {pendingRequests.slice(0, 5).map(req => (
                <div key={req.id} className="flex flex-col border-b border-slate-100 dark:border-slate-700 pb-3 last:border-0" onClick={() => onNavigate('inventory')}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{req.number}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{new Date(req.requestedDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{req.notes || 'Sin notas'}</p>
                  <div className="mt-2 flex gap-1">
                    {req.items.slice(0, 2).map((item, i) => (
                      <span key={i} className="text-[9px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{inventory.find(p => p.id === item.partId)?.name}</span>
                    ))}
                    {req.items.length > 2 && <span className="text-[9px] text-slate-400">+{req.items.length - 2}</span>}
                  </div>
                </div>
              ))}
              {pendingRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3">
                  <Package size={40} className="text-slate-200 dark:text-slate-700" />
                  <p className="text-sm">No hay solicitudes nuevas</p>
                </div>
              )}
            </div>
            {pendingRequests.length > 5 && (
              <button
                onClick={() => onNavigate('inventory')}
                className="mt-4 w-full py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                GESTIONAR ({pendingRequests.length})
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Section Manager Layout ---
  if (currentUser.role === UserRole.SECTION_MANAGER) {
    // Filter WOs for this manager's sections
    const mySectionWOs = workOrders.filter(wo => {
      const isCollaborator = (wo.collaboratingSections || []).some(s => currentUser.sections.includes(s));
      return currentUser.sections.includes(wo.section) || isCollaborator;
    });

    const pendingWOs = mySectionWOs.filter(wo => wo.status === WOStatus.PENDING); // Filter strictly Pending
    const unassignedWOs = mySectionWOs.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED);
    const scheduledWOs = mySectionWOs.filter(wo => wo.status === WOStatus.SCHEDULED);
    const criticalWOs = mySectionWOs.filter(wo => (wo.priority === WOPriority.CRITICAL || wo.priority === WOPriority.HIGH) && wo.status !== WOStatus.COMPLETED);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Panel de {currentUser.sections[0] || 'Sección'}</h1>
            <p className="text-slate-500 dark:text-slate-400">Resumen de operaciones y mantenimiento.</p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', { status: [WOStatus.PENDING] })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg text-yellow-600 dark:text-yellow-400">
                <Clock size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{pendingWOs.length}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pendientes</p>
          </div>

          <div
            className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', { unassigned: true })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                <Users size={20} />
              </div>
              {unassignedWOs.length > 0 && <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Acción Req.</span>}
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{unassignedWOs.length}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin Asignar</p>
          </div>

          <div
            className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', { status: [WOStatus.SCHEDULED] })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                <Calendar size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{scheduledWOs.length}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Programadas</p>
          </div>

          <div
            className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', {
              priority: [WOPriority.CRITICAL, WOPriority.HIGH],
              status: [WOStatus.PENDING, WOStatus.IN_PROGRESS, WOStatus.SCHEDULED]
            })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600 dark:text-red-400">
                <AlertTriangle size={20} />
              </div>
              {criticalWOs.length > 0 && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Prioritario</span>}
            </div>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{criticalWOs.length}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Críticas / Altas</p>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mt-8 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <button
            onClick={onCreateWorkOrder}
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="font-medium">Nueva Orden</span>
          </button>

          <button
            onClick={() => onNavigate('scheduler')}
            className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-2 rounded-lg group-hover:scale-110 transition-transform">
              <Calendar size={24} />
            </div>
            <span className="font-medium">Programador</span>
          </button>

          <button
            onClick={onRequestPurchase}
            className="bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-xl shadow-lg shadow-amber-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
              <ShoppingCart size={24} />
            </div>
            <span className="font-bold text-sm">Solicitud Material</span>
          </button>

          <button
            onClick={onRequestWithdrawal}
            className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
            <span className="font-medium">Sacar Repuesto</span>
          </button>
        </div>
      </div>
    );
  }

  // --- Standard Admin Dashboard ---
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Panel de Control</h1>
          <p className="text-slate-500 dark:text-slate-400">Bienvenido de nuevo, {currentUser.name}</p>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Órdenes Activas"
          value={activeWOs.length}
          icon={Clock}
          color="blue"
          onClick={() => onNavigate('maintenance')}
        />
        <KpiCard
          title="Sin Asignar"
          value={unassignedWOs.length}
          icon={Users}
          color="amber"
          onClick={() => onNavigate('scheduler')}
        />
        <KpiCard
          title="Críticas / Altas"
          value={criticalWOs.length}
          icon={AlertCircle}
          color="red"
          onClick={() => onNavigate('maintenance')}
        />
        <KpiCard
          title="Stock Bajo"
          value={lowStockItems.length}
          icon={Package}
          color="purple"
          onClick={() => onNavigate('inventory')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Activity Column */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Órdenes Recientes</h3>
            <button
              onClick={() => onNavigate('maintenance')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-4">
            {workOrders.slice(0, 5).map(wo => (
              <div key={wo.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-current opacity-90 ${getPriorityStyles(wo.priority)}`}>
                    {getPriorityIcon(wo.priority)}
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-800 dark:text-slate-200">{wo.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {equipment.find(e => e.id === wo.equipmentId)?.name || 'Equipo no especificado'} • {new Date(wo.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(wo.status)}`}>
                    {wo.status}
                  </span>
                </div>
              </div>
            ))}
            {workOrders.length === 0 && (
              <div className="text-center text-slate-400 py-4">No hay actividad reciente.</div>
            )}
          </div>
        </div>

        {/* Stats Column */}
        <div className="space-y-6">

          {/* Workload by Section */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-slate-400" />
              Carga por Sección
            </h3>
            <div className="space-y-4">
              {sortedSections.length > 0 ? sortedSections.map(([section, count], _, arr) => {
                const maxCount = arr.length > 0 ? arr[0][1] : 1; // First item is max because it's sorted descending
                return (
                  <div key={section}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-300">{section}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{count}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${maxCount > 0 ? ((count as number) / maxCount) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center text-slate-400 text-sm">Sin datos suficientes.</div>
              )}
            </div>
          </div>

          {/* Low Stock Alert Mini-List */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500" />
              Alertas de Stock
            </h3>
            <div className="space-y-3">
              {lowStockItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                  <span className="text-slate-600 dark:text-slate-300 truncate pr-2">{item.name}</span>
                  <span className="font-bold text-red-500 whitespace-nowrap">{item.quantity} un.</span>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/10 p-2 rounded">
                  <CheckCircle size={16} /> Todo en orden
                </div>
              )}
              {lowStockItems.length > 3 && (
                <button onClick={() => onNavigate('inventory')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline pt-2 w-full text-center">
                  Ver {lowStockItems.length - 3} más
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// Internal Component for KPI Cards
const KpiCard = ({ title, value, icon: Icon, color, onClick, suffix = "" }: { title: string, value: number, icon: any, color: string, onClick?: () => void, suffix?: string }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/50',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/50',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/50',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-900/50',
  }[color] || 'bg-slate-50 text-slate-600';

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 group relative overflow-hidden`}
    >
      <div className="flex justify-between items-start z-10 relative">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{value}{suffix}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses}`}>
          <Icon size={24} />
        </div>
      </div>
      {/* Decorative background element */}
      <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 ${colorClasses.split(' ')[0]} z-0 group-hover:scale-110 transition-transform`}></div>
    </div>
  );
};