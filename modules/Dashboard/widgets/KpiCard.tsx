import React from 'react';

interface KpiCardProps {
    title: string;
    value: number | string;
    icon: React.ComponentType<{ size?: number | string }>;
    color: 'blue' | 'amber' | 'red' | 'purple' | 'green';
    onClick?: () => void;
    suffix?: string;
}

const COLOR_CLASSES: Record<string, string> = {
    blue: 'bg-accent-dim text-accent border-accent-border',
    amber: 'bg-warn-dim text-warn border-warn-border',
    red: 'bg-ko-dim text-ko border-ko-border',
    purple: 'bg-spec-dim text-spec border-spec-border',
    green: 'bg-ok-dim text-ok border-ok-border'
};

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon: Icon, color, onClick, suffix = '' }) => {
    const colorClasses = COLOR_CLASSES[color] || 'bg-surface-2 text-txt-2';
    return (
        <div
            onClick={onClick}
            className={`p-6 rounded-xl border transition-all duration-300 bg-surface border-line group relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1' : ''}`}
        >
            <div className="flex justify-between items-start z-10 relative">
                <div>
                    <p className="text-sm font-medium text-txt-2 mb-1">{title}</p>
                    <h3 className="text-3xl font-extrabold text-txt">{value}{suffix}</h3>
                </div>
                <div className={`p-3 rounded-lg border ${colorClasses}`}>
                    <Icon size={24} />
                </div>
            </div>
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 ${colorClasses.split(' ')[0]} z-0 group-hover:scale-110 transition-transform`}></div>
        </div>
    );
};
