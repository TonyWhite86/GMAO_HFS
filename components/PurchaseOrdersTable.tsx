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
            case POStatus.REQUESTED: return 'bg-warn-dim text-warn';
            case POStatus.DRAFT: return 'bg-surface-2 text-txt-2 bg-surface text-txt-2';
            case POStatus.ORDERED: return 'bg-accent-dim text-accent';
            case POStatus.PARTIAL: return 'bg-accent-dim text-accent';
            case POStatus.RECEIVED: return 'bg-ok-dim text-ok';
            case POStatus.CANCELLED: return 'bg-ko-dim text-ko';
            default: return 'bg-surface-2 text-txt-2';
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
            <div className="bg-surface rounded-xl p-12 text-center border-2 border-dashed border-line">
                <Package className="mx-auto h-12 w-12 text-txt-3 mb-4" />
                <h3 className="text-lg font-bold text-txt mb-2">No hay registros</h3>
                <p className="text-txt-2 text-sm">No se encontraron solicitudes o pedidos.</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-surface-2">
                            <th className="px-6 py-4 text-xs font-bold text-txt-2 uppercase tracking-wider rounded-tl-xl border-b border-line">Número</th>
                            <th className="px-6 py-4 text-xs font-bold text-txt-2 uppercase tracking-wider border-b border-line">Estado</th>
                            <th className="px-6 py-4 text-xs font-bold text-txt-2 uppercase tracking-wider border-b border-line">Solicitado</th>
                            <th className="px-6 py-4 text-xs font-bold text-txt-2 uppercase tracking-wider border-b border-line">Entrega Prevista</th>
                            <th className="px-6 py-4 text-xs font-bold text-txt-2 uppercase tracking-wider border-b border-line">{canViewSensibleInfo ? 'Proveedor / Notas' : 'Notas'}</th>
                            {canViewSensibleInfo && <th className="px-6 py-4 text-xs font-bold text-txt-2 uppercase tracking-wider border-b border-line">Importe</th>}
                            <th className="px-6 py-4 text-right rounded-tr-xl border-b border-line"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {orders.map((order) => (
                            <tr
                                key={order.id}
                                onClick={() => onRowClick(order)}
                                className="bg-surface/50 hover:bg-accent-dim/30 cursor-pointer transition-colors group"
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-mono font-bold text-txt-2">
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
                                    <div className="text-sm text-txt-2">
                                        {new Date(order.requestedDate).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className={`text-sm font-bold ${order.expectedDate ? 'text-accent' : 'text-txt-3'}`}>
                                        {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : 'Pendiente'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm font-medium text-txt truncate max-w-[200px]">
                                        {canViewSensibleInfo ? (order.supplier || order.notes || '---') : (order.notes || '---')}
                                    </div>
                                </td>
                                {canViewSensibleInfo && (
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-bold text-txt italic">
                                            {order.totalAmount > 0 ? `${order.totalAmount.toFixed(2)} €` : '---'}
                                        </div>
                                    </td>
                                )}
                                <td className="px-6 py-4 text-right">
                                    <ChevronRight className="inline-block text-txt-3 group-hover:text-accent transition-colors" size={20} />
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
                        className="bg-surface p-4 rounded-xl shadow-sm border border-line active:scale-[0.98] transition-transform"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <span className="font-mono text-xs font-bold bg-surface-2 text-txt-2 px-2 py-1 rounded">
                                    {order.number}
                                </span>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusStyle(order.status)}`}>
                                {getStatusIcon(order.status)}
                                {order.status}
                            </span>
                        </div>

                        <div className="mb-3">
                            <h4 className="font-bold text-txt mb-1">
                                {canViewSensibleInfo ? (order.supplier || 'Proveedor sin asignar') : 'Solicitud'}
                            </h4>
                            {order.notes && (
                                <p className="text-xs text-txt-2 line-clamp-2">
                                    {order.notes}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-txt-2 pt-3 border-t border-line">
                            <div className="flex gap-4">
                                <div>
                                    <span className="block text-[10px] uppercase text-txt-3">Solicitado</span>
                                    <span>{new Date(order.requestedDate).toLocaleDateString()}</span>
                                </div>
                                {order.expectedDate && (
                                    <div>
                                        <span className="block text-[10px] uppercase text-txt-3">Entrega</span>
                                        <span className="text-accent font-bold">{new Date(order.expectedDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>

                            {canViewSensibleInfo && order.totalAmount > 0 && (
                                <div className="text-right">
                                    <span className="block text-[10px] uppercase text-txt-3">Total</span>
                                    <span className="font-bold text-txt">{order.totalAmount.toFixed(2)} €</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};
