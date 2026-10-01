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
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/50',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/50',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/50',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-900/50',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border-green-100 dark:border-green-900/50',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800/20 dark:text-slate-400 border-slate-100 dark:border-slate-900/50',
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, onClick, suffix, subtext }) => {
    const colorClasses = colorMap[color] || 'bg-slate-100 text-slate-600 dark:bg-slate-800/20 dark:text-slate-400 border-slate-100 dark:border-slate-900/50';
    const isClickable = !!onClick;

    return (
        <div
            onClick={onClick}
            className={`p-6 rounded-xl border transition-all duration-300 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-700 group relative overflow-hidden ${isClickable ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1' : 'hover:shadow-md'}`}
        >
            <div className="flex justify-between items-start z-10 relative">
                <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{value}{suffix ?? ''}</h3>
                    {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
                </div>
                <div className={`p-3 rounded-lg ${colorClasses}`}>
                    <Icon size={24} />
                </div>
            </div>
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 ${colorClasses.split(' ').find(c => c.startsWith('bg-')) || 'bg-slate-100'} z-0 group-hover:scale-110 transition-transform`}></div>
        </div>
    );
};
