import React from 'react';
import { Box, AlertTriangle, AlertCircle, BarChart3, Plus, ArrowRight, Package, ShoppingCart, CheckCircle } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { StatCard } from '../../../components/ui/StatCard';
import { POStatus } from '../../../types';

interface WarehouseDashboardProps {
    onNavigate: (module: string) => void;
    onRequestWithdrawal: () => void;
}

export const WarehouseDashboard: React.FC<WarehouseDashboardProps> = ({ onNavigate, onRequestWithdrawal }) => {
    const { currentUser, workOrders, inventory, equipment, purchaseOrders } = useAppStore();

    const totalItems = inventory.length;
    const totalInvestment = inventory.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const criticalStock = inventory.filter(item => item.quantity <= item.minStock / 2).length;
    const lowStockItems = inventory.filter(item => item.quantity <= item.minStock);
    const pendingRequests = purchaseOrders.filter(po => po.status === POStatus.REQUESTED);

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
                <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm font-medium">
                    {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Artículos Totales" value={totalItems} icon={Box} color="blue" onClick={() => onNavigate('inventory')} />
                <StatCard title="Alertas de Stock" value={lowStockItems.length} icon={AlertTriangle} color="amber" onClick={() => onNavigate('inventory')} />
                <StatCard title="Suministro Crítico" value={criticalStock} icon={AlertCircle} color="red" onClick={() => onNavigate('inventory')} />
                <StatCard title="Valor Inventario" value={Math.round(totalInvestment)} icon={BarChart3} color="purple" suffix=" €" onClick={() => onNavigate('reports')} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => onNavigate('inventory')} className="flex items-center justify-between p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all active:scale-95 group">
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
                <button onClick={onRequestWithdrawal} className="flex items-center justify-between p-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg transition-all active:scale-95 group">
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
                <div className="lg:col-span-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-6">Consumos Recientes</h3>
                    <div className="space-y-4">
                        {recentWithdrawals.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
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
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">-{item.quantity} un.</span>
                                </div>
                            </div>
                        ))}
                        {recentWithdrawals.length === 0 && (
                            <div className="text-center py-10 text-slate-400">No hay registros de consumo recientes.</div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
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
                                    <span className={`text-sm font-bold ${item.quantity <= item.minStock / 2 ? 'text-red-500' : 'text-amber-500'}`}>{item.quantity} un.</span>
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
                        <button onClick={() => onNavigate('inventory')} className="mt-4 w-full py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            VER TODOS ({lowStockItems.length})
                        </button>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
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
                        <button onClick={() => onNavigate('inventory')} className="mt-4 w-full py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            GESTIONAR ({pendingRequests.length})
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
