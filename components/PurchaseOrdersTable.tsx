import React from 'react';
import { PurchaseOrder, POStatus, User, UserRole, InventoryItem } from '../types';
import { Clock, CheckCircle2, AlertCircle, Trash2, Edit, ChevronRight, Package, ShoppingCart } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface PurchaseOrdersTableProps {
    orders: PurchaseOrder[];
    onRowClick: (order: PurchaseOrder) => void;
    onDelete?: (id: string) => void;
    currentUser: User;
    inventory: InventoryItem[];
}

export const PurchaseOrdersTable: React.FC<PurchaseOrdersTableProps> = ({
    orders,
    onRowClick,
    onDelete,
    currentUser,
    inventory
}) => {
    const userPermissions = useAppStore(s => s.userPermissions);
    const currentPermission = userPermissions.find(p => p.userId === currentUser.id && p.module === 'inventory');
    const invLevel = currentUser.role === UserRole.ADMIN ? 'total' : (currentPermission?.level ?? 'sin_acceso');
    const canViewSensibleInfo = invLevel === 'parcial' || invLevel === 'total';

    const getStatusStyle = (status: POStatus) => {
        switch (status) {
            case POStatus.REQUESTED: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case POStatus.DRAFT: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
            case POStatus.ORDERED: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case POStatus.PARTIAL: return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case POStatus.RECEIVED: return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case POStatus.CANCELLED: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getStatusIcon = (status: POStatus) => {
        switch (status) {
            case POStatus.REQUESTED: return <ShoppingCart size={14} />;
            case POStatus.RECEIVED: return <CheckCircle2 size={14} />;
            case POStatus.ORDERED: return <Clock size={14} />;
            case POStatus.CANCELLED: return <Trash2 size={14} />;
            default: return <Package size={14} />;
        }
    };

    if (orders.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-700 rounded-xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Package className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">No hay registros</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">No se encontraron solicitudes o pedidos.</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700/50">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider rounded-tl-xl border-b border-slate-200 dark:border-slate-700">Número</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Estado</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Solicitado</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Entrega Prevista</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">{canViewSensibleInfo ? 'Proveedor / Notas' : 'Notas'}</th>
                            {canViewSensibleInfo && <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Importe</th>}
                            <th className="px-6 py-4 text-right rounded-tr-xl border-b border-slate-200 dark:border-slate-700"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {orders.map((order) => (
                            <tr
                                key={order.id}
                                onClick={() => onRowClick(order)}
                                className="bg-white dark:bg-slate-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group"
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {order.number}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${getStatusStyle(order.status)}`}>
                                        {getStatusIcon(order.status)}
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        {new Date(order.requestedDate).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className={`text-sm font-bold ${order.expectedDate ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                        {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'Pendiente'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-slate-800 dark:text-white truncate max-w-[200px]">
                                        {canViewSensibleInfo ? (order.supplier || order.notes || '---') : (order.notes || '---')}
                                    </div>
                                </td>
                                {canViewSensibleInfo && (
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white italic">
                                            {order.totalAmount > 0 ? `${order.totalAmount.toFixed(2)} €` : '---'}
                                        </div>
                                    </td>
                                )}
                                <td className="px-6 py-4 text-right">
                                    <ChevronRight className="inline-block text-slate-300 group-hover:text-blue-500 transition-colors" size={20} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {orders.map((order) => (
                    <div
                        key={order.id}
                        onClick={() => onRowClick(order)}
                        className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 active:scale-[0.98] transition-transform"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                                    {order.number}
                                </span>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusStyle(order.status)}`}>
                                {getStatusIcon(order.status)}
                                {order.status}
                            </span>
                        </div>

                        <div className="mb-3">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-1">
                                {canViewSensibleInfo ? (order.supplier || 'Proveedor sin asignar') : 'Solicitud'}
                            </h4>
                            {order.notes && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                    {order.notes}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex gap-4">
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400">Solicitado</span>
                                    <span>{new Date(order.requestedDate).toLocaleDateString()}</span>
                                </div>
                                {order.expectedDate && (
                                    <div>
                                        <span className="block text-[10px] uppercase text-slate-400">Entrega</span>
                                        <span className="text-blue-600 dark:text-blue-400 font-bold">{new Date(order.expectedDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>

                            {canViewSensibleInfo && order.totalAmount > 0 && (
                                <div className="text-right">
                                    <span className="block text-[10px] uppercase text-slate-400">Total</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{order.totalAmount.toFixed(2)} €</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};
