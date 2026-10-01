import React from 'react';
import { WOPriority } from '../../types';
import { PRIORITY_CONFIG } from '../../constants';

interface PriorityIndicatorProps {
    priority: WOPriority;
    showLabel?: boolean;
    className?: string;
}

export const PriorityIndicator: React.FC<PriorityIndicatorProps> = ({
    priority,
    showLabel = true,
    className = ''
}) => {
    const config = PRIORITY_CONFIG[priority];
    if (!config) return null;

    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            <div className={`p-1.5 rounded-lg flex items-center justify-center ${config.bgClass}`}>
                <Icon size={14} />
            </div>
            {showLabel && (
                <span className="text-sm text-slate-700 dark:text-slate-300 font-bold">
                    {config.label}
                </span>
            )}
        </div>
    );
};
