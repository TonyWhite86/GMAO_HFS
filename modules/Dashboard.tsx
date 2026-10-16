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

import { useAppStore } from '../store/useAppStore';
import { getStatusColor, PRIORITY_CONFIG } from '../constants';

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
            <h1 className="text-2xl font-bold text-txt">Hola, {currentUser.name.split(' ')[0]}</h1>
            <p className="text-txt-2">Tienes <span className="font-bold text-txt">{myAssignedWOs.length}</span> trabajos pendientes para hoy.</p>
          </div>
          <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={onRequestWithdrawal}
            className="bg-surface text-txt-2 border border-line p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-ko-dim text-ko p-2 rounded-lg group-hover:scale-110 transition-transform">
              <Package size={24} />
            </div>
            <span className="font-medium text-sm">Retirar Material</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Assigned Tasks List */}
          <div className="space-y-4">
            <h3 className="font-bold text-txt text-lg flex items-center gap-2 px-1">
              <Wrench size={20} className="text-accent" />
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
                <div className="bg-surface rounded-xl shadow-sm border border-line p-8 text-center text-txt-2">
                  <CheckCircle size={48} className="mx-auto mb-4 text-ok opacity-50" />
                  <p className="text-lg font-medium">¡Todo al día!</p>
                  <p>No tienes tareas asignadas retrasadas o para realizar hoy.</p>
                </div>
              )}
            </div>
          </div>

          {/* Tomorrow's Tasks List */}
          {myTomorrowWOs.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-txt text-lg flex items-center gap-2 px-1 opacity-75">
                <Calendar size={20} className="text-spec" />
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
            <h1 className="text-2xl font-bold text-txt">Panel de Almacén</h1>
            <p className="text-txt-2">Control de repuestos y suministros.</p>
          </div>
          <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm font-medium">
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
            className="grad-primary flex items-center justify-between p-4 rounded-xl shadow-lg text-white transition-all active:scale-95 group hover:brightness-110"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-lg group-hover:rotate-12 transition-transform">
                <Plus size={24} />
              </div>
              <div className="text-left">
                <span className="block font-bold">Añadir Artículo</span>
                <span className="text-xs opacity-80">Registrar nuevo repuesto en el sistema</span>
              </div>
            </div>
            <ArrowRight size={20} className="opacity-50" />
          </button>

          <button
            onClick={onRequestWithdrawal}
            className="grad-primary flex items-center justify-between p-4 rounded-xl shadow-lg text-white transition-all active:scale-95 group hover:brightness-110"
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-lg group-hover:rotate-12 transition-transform">
                <ShoppingCart size={24} />
              </div>
              <div className="text-left">
                <span className="block font-bold">Modo Retirada</span>
                <span className="text-xs opacity-80">Sacar material del inventario</span>
              </div>
            </div>
            <ArrowRight size={20} className="opacity-50" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Withdrawals (Consumption) */}
          <div className="lg:col-span-2 bg-surface rounded-xl shadow-sm border border-line p-6">
            <h3 className="font-bold text-txt text-lg mb-6">Consumos Recientes</h3>
            <div className="space-y-4">
              {recentWithdrawals.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-surface-2 rounded-lg transition-colors border border-transparent hover:border-line">
                  <div className="flex items-center gap-4">
                    <div className="bg-surface-2 p-2 rounded-lg text-txt-2">
                      <Package size={18} />
                    </div>
                    <div>
                      <h4 className="font-medium text-txt text-txt-2">{item.part?.name || 'Repuesto desconocido'}</h4>
                      <p className="text-xs text-txt-2">
                        {item.equipment} • {new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-txt-2">
                      -{item.quantity} un.
                    </span>
                  </div>
                </div>
              ))}
              {recentWithdrawals.length === 0 && (
                <div className="text-center py-10 text-txt-3">
                  No hay registros de consumo recientes.
                </div>
              )}
            </div>
          </div>

          {/* Low Stock Watchlist */}
          <div className="bg-surface rounded-xl shadow-sm border border-line p-6 flex flex-col">
            <h3 className="font-bold text-txt text-lg mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-warn" />
              Alerta de Reposición
            </h3>
            <div className="flex-1 space-y-4">
              {lowStockItems.slice(0, 10).map(item => (
                <div key={item.id} className="flex justify-between items-center group cursor-pointer" onClick={() => onNavigate('inventory')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-txt-2 truncate">{item.name}</p>
                    <p className="text-xs text-txt-2">Mínimo: {item.minStock} un.</p>
                  </div>
                  <div className="ml-4 text-right">
                    <span className={`text-sm font-bold ${item.quantity <= item.minStock / 2 ? 'text-ko' : 'text-warn'}`}>
                      {item.quantity} un.
                    </span>
                  </div>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-txt-3 gap-3">
                  <CheckCircle size={40} className="text-ok/50" />
                  <p className="text-sm">Stock bajo control</p>
                </div>
              )}
            </div>
            {lowStockItems.length > 10 && (
              <button
                onClick={() => onNavigate('inventory')}
                className="mt-4 w-full py-2 text-xs font-bold text-accent hover:bg-accent-dim rounded-lg transition-colors"
              >
                VER TODOS ({lowStockItems.length})
              </button>
            )}
          </div>

          {/* Pending Requests Mini-List */}
          <div className="bg-surface rounded-xl shadow-sm border border-line p-6 flex flex-col">
            <h3 className="font-bold text-txt text-lg mb-4 flex items-center gap-2">
              <ShoppingCart size={20} className="text-warn" />
              Solicitudes Pendientes
            </h3>
            <div className="flex-1 space-y-4">
              {pendingRequests.slice(0, 5).map(req => (
                <div key={req.id} className="flex flex-col border-b border-line pb-3 last:border-0" onClick={() => onNavigate('inventory')}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold text-txt-2">{req.number}</span>
                    <span className="text-[10px] text-txt-3 font-mono">{new Date(req.requestedDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                  <p className="text-xs text-txt-2 line-clamp-1">{req.notes || 'Sin notas'}</p>
                  <div className="mt-2 flex gap-1">
                    {req.items.slice(0, 2).map((item, i) => (
                      <span key={i} className="text-[9px] bg-surface-2 px-1.5 py-0.5 rounded text-txt-2">{inventory.find(p => p.id === item.partId)?.name}</span>
                    ))}
                    {req.items.length > 2 && <span className="text-[9px] text-txt-3">+{req.items.length - 2}</span>}
                  </div>
                </div>
              ))}
              {pendingRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-txt-3 gap-3">
                  <Package size={40} className="text-txt-3" />
                  <p className="text-sm">No hay solicitudes nuevas</p>
                </div>
              )}
            </div>
            {pendingRequests.length > 5 && (
              <button
                onClick={() => onNavigate('inventory')}
                className="mt-4 w-full py-2 text-xs font-bold text-accent hover:bg-accent-dim rounded-lg transition-colors"
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
            <h1 className="text-2xl font-bold text-txt">Panel de {currentUser.sections[0] || 'Sección'}</h1>
            <p className="text-txt-2">Resumen de operaciones y mantenimiento.</p>
          </div>
          <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', { status: [WOStatus.PENDING] })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-warn-dim p-2 rounded-lg text-warn">
                <Clock size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-txt mb-1">{pendingWOs.length}</h3>
            <p className="text-sm text-txt-2">Pendientes</p>
          </div>

          <div
            className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', { unassigned: true })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-warn-dim p-2 rounded-lg text-warn">
                <Users size={20} />
              </div>
              {unassignedWOs.length > 0 && <span className="text-xs font-bold bg-warn-dim text-warn px-2 py-0.5 rounded-full">Acción Req.</span>}
            </div>
            <h3 className="text-2xl font-bold text-txt mb-1">{unassignedWOs.length}</h3>
            <p className="text-sm text-txt-2">Sin Asignar</p>
          </div>

          <div
            className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', { status: [WOStatus.SCHEDULED] })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-spec-dim p-2 rounded-lg text-spec">
                <Calendar size={20} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-txt mb-1">{scheduledWOs.length}</h3>
            <p className="text-sm text-txt-2">Programadas</p>
          </div>

          <div
            className="bg-surface p-4 rounded-xl shadow-sm border border-line cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigateWithFilter?.('maintenance', {
              priority: [WOPriority.CRITICAL, WOPriority.HIGH],
              status: [WOStatus.PENDING, WOStatus.IN_PROGRESS, WOStatus.SCHEDULED]
            })}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="bg-ko-dim p-2 rounded-lg text-ko">
                <AlertTriangle size={20} />
              </div>
              {criticalWOs.length > 0 && <span className="text-xs font-bold bg-ko-dim text-ko px-2 py-0.5 rounded-full">Prioritario</span>}
            </div>
            <h3 className="text-2xl font-bold text-txt mb-1">{criticalWOs.length}</h3>
            <p className="text-sm text-txt-2">Críticas / Altas</p>
          </div>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-txt mt-8 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <button
            onClick={onCreateWorkOrder}
            className="btn btn-primary text-white p-4 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="font-medium">Nueva Orden</span>
          </button>

          <button
            onClick={() => onNavigate('scheduler')}
            className="bg-surface text-txt-2 border border-line p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-spec-dim text-spec p-2 rounded-lg group-hover:scale-110 transition-transform">
              <Calendar size={24} />
            </div>
            <span className="font-medium">Programador</span>
          </button>

          <button
            onClick={onRequestPurchase}
            className="text-white p-4 rounded-xl shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group hover:brightness-110" style={{ background: 'var(--amber)' }}
          >
            <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
              <ShoppingCart size={24} />
            </div>
            <span className="font-bold text-sm">Solicitud Material</span>
          </button>

          <button
            onClick={onRequestWithdrawal}
            className="bg-surface text-txt-2 border border-line p-4 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group"
          >
            <div className="bg-ok-dim text-ok p-2 rounded-lg group-hover:scale-110 transition-transform">
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
          <h1 className="text-2xl font-bold text-txt">Panel de Control</h1>
          <p className="text-txt-2">Bienvenido de nuevo, {currentUser.name}</p>
        </div>
        <div className="text-sm text-txt-2 bg-surface px-4 py-2 rounded-lg border border-line shadow-sm">
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
        <div className="lg:col-span-2 bg-surface rounded-xl shadow-sm border border-line p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-txt text-lg">Órdenes Recientes</h3>
            <button
              onClick={() => onNavigate('maintenance')}
              className="text-sm text-accent hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-4">
            {workOrders.slice(0, 5).map(wo => (
              <div key={wo.id} className="flex items-center justify-between p-3 hover:bg-surface-2 rounded-lg transition-colors border border-transparent hover:border-line">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-current opacity-90 ${PRIORITY_CONFIG[wo.priority]?.bgClass}`}>
                    {React.createElement(PRIORITY_CONFIG[wo.priority]?.icon || Clock, { size: 14 })}
                  </div>
                  <div>
                    <h4 className="font-medium text-txt text-txt-2">{wo.title}</h4>
                    <p className="text-xs text-txt-2">
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
              <div className="text-center text-txt-3 py-4">No hay actividad reciente.</div>
            )}
          </div>
        </div>

        {/* Stats Column */}
        <div className="space-y-6">

          {/* Workload by Section */}
          <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
            <h3 className="font-bold text-txt text-lg mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-txt-3" />
              Carga por Sección
            </h3>
            <div className="space-y-4">
              {sortedSections.length > 0 ? sortedSections.map(([section, count], _, arr) => {
                const maxCount = arr.length > 0 ? arr[0][1] : 1; // First item is max because it's sorted descending
                return (
                  <div key={section}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-txt-2">{section}</span>
                      <span className="font-bold text-txt">{count}</span>
                    </div>
                    <div className="w-full bg-surface-2 rounded-full h-2">
                      <div
                        className="bg-accent h-2 rounded-full"
                        style={{ width: `${maxCount > 0 ? ((count as number) / maxCount) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center text-txt-3 text-sm">Sin datos suficientes.</div>
              )}
            </div>
          </div>

          {/* Low Stock Alert Mini-List */}
          <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
            <h3 className="font-bold text-txt text-lg mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-warn" />
              Alertas de Stock
            </h3>
            <div className="space-y-3">
              {lowStockItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm border-b border-line pb-2 last:border-0 last:pb-0">
                  <span className="text-txt-2 truncate pr-2">{item.name}</span>
                  <span className="font-bold text-ko whitespace-nowrap">{item.quantity} un.</span>
                </div>
              ))}
              {lowStockItems.length === 0 && (
                <div className="flex items-center gap-2 text-ok text-sm bg-ok-dim p-2 rounded">
                  <CheckCircle size={16} /> Todo en orden
                </div>
              )}
              {lowStockItems.length > 3 && (
                <button onClick={() => onNavigate('inventory')} className="text-xs text-accent hover:underline pt-2 w-full text-center">
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
    blue: 'bg-accent-dim text-accent border-accent-border',
    amber: 'bg-warn-dim text-warn border-warn-border',
    red: 'bg-ko-dim text-ko border-ko-border',
    purple: 'bg-spec-dim text-spec border-spec-border',
  }[color] || 'bg-surface-2 text-txt-2';

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-xl border transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 bg-surface border-line group relative overflow-hidden`}
    >
      <div className="flex justify-between items-start z-10 relative">
        <div>
          <p className="text-sm font-medium text-txt-2 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-txt">{value}{suffix}</h3>
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