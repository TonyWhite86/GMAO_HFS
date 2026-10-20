import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ size?: number | string }>;
    color: string;
    onClick?: () => void;
    suffix?: string;
    subtext?: string;
}

const colorMap: Record<string, string> = {
    blue: 'bg-accent-dim text-accent border-accent-border',
    amber: 'bg-warn-dim text-warn border-warn-border',
    red: 'bg-ko-dim text-ko border-ko-border',
    purple: 'bg-spec-dim text-spec border-spec-border',
    green: 'bg-ok-dim text-ok border-ok-border',
    emerald: 'bg-ok-dim text-ok border-ok-border',
    slate: 'bg-surface-3 text-txt-2 border-line',
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, onClick, suffix, subtext }) => {
    const colorClasses = colorMap[color] || colorMap.slate;
    const isClickable = !!onClick;

    return (
        <div
            onClick={onClick}
            className={`stat-card p-6 ${isClickable ? '' : '!cursor-default'}`}
        >
            <div className="flex justify-between items-start z-10 relative">
                <div>
                    <p className="text-sm font-medium text-txt-2 mb-1">{title}</p>
                    <h3 className="text-3xl font-extrabold text-txt">{value}{suffix ?? ''}</h3>
                    {subtext && <p className="text-xs text-txt-3 mt-1">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-lg border ${colorClasses}`}>
                    <Icon size={24} />
                </div>
            </div>
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 ${colorClasses.split(' ').find(c => c.startsWith('bg-')) || 'bg-surface-3'} z-0 group-hover:scale-110 transition-transform`}></div>
        </div>
    );
};
