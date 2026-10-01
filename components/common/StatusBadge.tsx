import React from 'react';
import { WOStatus, IncidentStatus } from '../../types';
import { WO_STATUS_CONFIG, INCIDENT_STATUS_CONFIG } from '../../constants';

interface StatusBadgeProps {
    status: WOStatus | IncidentStatus;
    type: 'workOrder' | 'incident';
    className?: string;
    showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    type,
    className = '',
    showIcon = true
}) => {
    const config = type === 'workOrder'
        ? WO_STATUS_CONFIG[status as WOStatus]
        : INCIDENT_STATUS_CONFIG[status as IncidentStatus];

    if (!config) return null;

    const Icon = config.icon;

    return (
        <span className={`px-2 py-1 rounded-full text-[11px] font-bold uppercase border flex items-center gap-1.5 w-fit ${config.bgClass} ${className}`}>
            {showIcon && <Icon size={14} className={type === 'incident' ? (config as any).colorClass : ''} />}
            {config.label}
        </span>
    );
};
