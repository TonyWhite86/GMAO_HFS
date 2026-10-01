import { WOStatus, WOPriority, WOType, IncidentStatus } from './types';
import {
    AlertCircle, Clock, CheckCircle2, XCircle, FileText,
    AlertTriangle, PlayCircle, PauseCircle, Calendar,
    ArrowRight, Info
} from 'lucide-react';

export const WO_STATUS_CONFIG = {
    [WOStatus.PENDING]: {
        label: 'Pendiente',
        icon: AlertCircle,
        bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
        actionIcon: PlayCircle,
        actionLabel: 'Empezar'
    },
    [WOStatus.SCHEDULED]: {
        label: 'Programada',
        icon: Calendar,
        bgClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        actionIcon: Calendar,
        actionLabel: 'Programar'
    },
    [WOStatus.IN_PROGRESS]: {
        label: 'En Progreso',
        icon: Clock,
        bgClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        actionIcon: PauseCircle,
        actionLabel: 'Pausar'
    },
    [WOStatus.COMPLETED]: {
        label: 'Completada',
        icon: CheckCircle2,
        bgClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
        actionIcon: CheckCircle2,
        actionLabel: 'Finalizar'
    }
};

export const INCIDENT_STATUS_CONFIG = {
    [IncidentStatus.OPEN]: {
        label: 'Abierta',
        icon: AlertCircle,
        colorClass: 'text-amber-500',
        bgClass: 'bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50'
    },
    [IncidentStatus.IN_REVIEW]: {
        label: 'En Revisión',
        icon: Clock,
        colorClass: 'text-blue-500',
        bgClass: 'bg-blue-100/50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50'
    },
    [IncidentStatus.CONVERTED]: {
        label: 'Convertida a OT',
        icon: FileText,
        colorClass: 'text-purple-500',
        bgClass: 'bg-purple-100/50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/50'
    },
    [IncidentStatus.RESOLVED]: {
        label: 'Resuelta',
        icon: CheckCircle2,
        colorClass: 'text-emerald-500',
        bgClass: 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50'
    },
    [IncidentStatus.CANCELLED]: {
        label: 'Cancelada',
        icon: XCircle,
        colorClass: 'text-slate-400',
        bgClass: 'bg-slate-100/50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50'
    }
};

export const PRIORITY_CONFIG = {
    [WOPriority.CRITICAL]: {
        label: 'Crítica',
        icon: AlertTriangle,
        color: 'red',
        bgClass: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 shadow-sm shadow-red-500/10'
    },
    [WOPriority.HIGH]: {
        label: 'Alta',
        icon: AlertTriangle,
        color: 'orange',
        bgClass: 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 shadow-sm shadow-amber-500/10'
    },
    [WOPriority.MEDIUM]: {
        label: 'Media',
        icon: Clock,
        color: 'blue',
        bgClass: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20 shadow-sm shadow-blue-500/10'
    },
    [WOPriority.LOW]: {
        label: 'Baja',
        icon: Clock,
        color: 'slate',
        bgClass: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/20 dark:to-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm shadow-slate-500/5'
    }
};

export const PERMISSION_MODULES = [
    { id: 'inventory', label: 'Inventario' },
] as const;

export const PERMISSION_LEVELS = [
    { id: 'sin_acceso' as const, label: 'Sin Acceso', description: 'No puede ver nada' },
    { id: 'consulta' as const, label: 'Consulta', description: 'Solo ver SKU, nombre, stock, ubicación' },
    { id: 'parcial' as const, label: 'Parcial', description: 'Ver precios, alta, movimientos, pedidos' },
    { id: 'total' as const, label: 'Total', description: 'Control completo: editar y fusionar artículos' },
];

export const WAREHOUSE_KEYWORDS = ['almacen', 'logistica'];

export const getStatusColor = (status: WOStatus): string =>
    WO_STATUS_CONFIG[status]?.bgClass || 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-600';

export const WO_TYPE_CONFIG = {
    [WOType.CORRECTIVE]: {
        label: 'Correctivo',
        bgClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    [WOType.PREVENTIVE]: {
        label: 'Preventivo',
        bgClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
    },
    [WOType.PLANNED]: {
        label: 'Actuación',
        bgClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    }
};