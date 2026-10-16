import { WOStatus, WOPriority, WOType, IncidentStatus, StoppageReasonType, StoppageStatus } from './types';
import {
    AlertCircle, Clock, CheckCircle2, XCircle, FileText,
    AlertTriangle, PlayCircle, PauseCircle, Calendar,
    Info, Wrench, Building2
} from 'lucide-react';

// Semántica de color (Pulso): pendiente=ámbar, activo=azul, completado=verde,
// cancelado=rojo; tipo: correctivo=azul, preventivo=verde, mejora=púrpura.
// Clases = variantes .bdg-* de index.css (tema-aware).

export const WO_STATUS_CONFIG = {
    [WOStatus.PENDING]: {
        label: 'Pendiente',
        icon: AlertCircle,
        bgClass: 'bdg-amber',
        dotColor: 'var(--amber)',
        actionIcon: PlayCircle,
        actionLabel: 'Empezar'
    },
    [WOStatus.SCHEDULED]: {
        label: 'Programada',
        icon: Calendar,
        bgClass: 'bdg-purple',
        dotColor: 'var(--purple)',
        actionIcon: Calendar,
        actionLabel: 'Programar'
    },
    [WOStatus.IN_PROGRESS]: {
        label: 'En Progreso',
        icon: Clock,
        bgClass: 'bdg-accent',
        dotColor: 'var(--accent)',
        actionIcon: PauseCircle,
        actionLabel: 'Pausar'
    },
    [WOStatus.COMPLETED]: {
        label: 'Completada',
        icon: CheckCircle2,
        bgClass: 'bdg-green',
        dotColor: 'var(--green)',
        actionIcon: CheckCircle2,
        actionLabel: 'Finalizar'
    }
};

export const INCIDENT_STATUS_CONFIG = {
    [IncidentStatus.OPEN]: {
        label: 'Abierta',
        icon: AlertCircle,
        colorClass: 'text-warn',
        bgClass: 'bdg-amber'
    },
    [IncidentStatus.IN_REVIEW]: {
        label: 'En Revisión',
        icon: Clock,
        colorClass: 'text-accent',
        bgClass: 'bdg-accent'
    },
    [IncidentStatus.CONVERTED]: {
        label: 'Convertida a OT',
        icon: FileText,
        colorClass: 'text-spec',
        bgClass: 'bdg-purple'
    },
    [IncidentStatus.RESOLVED]: {
        label: 'Resuelta',
        icon: CheckCircle2,
        colorClass: 'text-ok',
        bgClass: 'bdg-green'
    },
    [IncidentStatus.CANCELLED]: {
        label: 'Cancelada',
        icon: XCircle,
        colorClass: 'text-ko',
        bgClass: 'bdg-red'
    }
};

export const PRIORITY_CONFIG = {
    [WOPriority.CRITICAL]: {
        label: 'Crítica',
        icon: AlertTriangle,
        color: 'red',
        bgClass: 'bg-ko-dim text-ko border-ko-border',
        dotColor: 'var(--red)'
    },
    [WOPriority.HIGH]: {
        label: 'Alta',
        icon: AlertTriangle,
        color: 'orange',
        bgClass: 'bg-warn-dim text-warn border-warn-border',
        dotColor: 'var(--amber)'
    },
    [WOPriority.MEDIUM]: {
        label: 'Media',
        icon: Clock,
        color: 'blue',
        bgClass: 'bg-accent-dim text-accent border-accent-border',
        dotColor: 'var(--accent)'
    },
    [WOPriority.LOW]: {
        label: 'Baja',
        icon: Clock,
        color: 'slate',
        bgClass: 'bg-surface-3 text-txt-2 border-line',
        dotColor: 'var(--text3)'
    }
};

export const PERMISSION_MODULES = [
    { id: 'inventory', label: 'Inventario' },
    { id: 'actuaciones', label: 'Actuaciones' },
    { id: 'paradas', label: 'Paradas' },
] as const;

export const PERMISSION_LEVELS = [
    { id: 'sin_acceso' as const, label: 'Sin Acceso', description: 'No puede ver nada' },
    { id: 'consulta' as const, label: 'Consulta', description: 'Solo ver' },
    { id: 'parcial' as const, label: 'Parcial', description: 'Ver y realizar acciones básicas' },
    { id: 'total' as const, label: 'Total', description: 'Control completo: crear, editar y eliminar' },
];

export const WAREHOUSE_KEYWORDS = ['almacen', 'logistica'];

export const getStatusColor = (status: WOStatus): string =>
    WO_STATUS_CONFIG[status]?.bgClass || 'bdg-gray';

export const WO_TYPE_CONFIG = {
    [WOType.CORRECTIVE]: {
        label: 'Correctivo',
        bgClass: 'bdg-accent',
        dotColor: 'var(--accent)'
    },
    [WOType.PREVENTIVE]: {
        label: 'Preventivo',
        bgClass: 'bdg-green',
        dotColor: 'var(--green)'
    },
    [WOType.PLANNED]: {
        label: 'Actuación',
        bgClass: 'bdg-purple',
        dotColor: 'var(--purple)'
    }
};

// Estilo neutro para paradas cuyo motivo no viene de StoppageReasonType
// (p.ej. una parada nacida de una incidencia con categoría a medida).
export const STOPPAGE_REASON_FALLBACK = {
    label: 'Otro',
    icon: Wrench,
    bgClass: 'bdg-gray'
};

export const STOPPAGE_REASON_CONFIG = {
    [StoppageReasonType.IMPROVEMENT]: {
        label: 'Mejora',
        icon: Wrench,
        bgClass: 'bdg-purple'
    },
    [StoppageReasonType.MAINTENANCE]: {
        label: 'Mantenimiento',
        icon: Wrench,
        bgClass: 'bdg-green'
    },
    [StoppageReasonType.THIRD_PARTY]: {
        label: 'Intervención de terceros',
        icon: Building2,
        bgClass: 'bdg-amber'
    },
    [StoppageReasonType.OTHER]: {
        label: 'Otro',
        icon: Info,
        bgClass: 'bdg-gray'
    }
};

export const STOPPAGE_STATUS_CONFIG = {
    [StoppageStatus.SCHEDULED]: {
        label: 'Programada',
        icon: Calendar,
        bgClass: 'bdg-accent'
    },
    [StoppageStatus.IN_PROGRESS]: {
        label: 'En curso',
        icon: PlayCircle,
        bgClass: 'bdg-amber'
    },
    [StoppageStatus.COMPLETED]: {
        label: 'Completada',
        icon: CheckCircle2,
        bgClass: 'bdg-green'
    },
    [StoppageStatus.CANCELLED]: {
        label: 'Cancelada',
        icon: XCircle,
        bgClass: 'bdg-red'
    }
};
