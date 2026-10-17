import React from 'react';

export interface QuickAction {
    label: string;
    icon: React.ComponentType<{ size?: number | string }>;
    onClick: () => void;
    tone?: 'primary' | 'amber' | 'ghost';
    sublabel?: string;
}

interface QuickActionsProps {
    actions: QuickAction[];
}

const TONE: Record<string, string> = {
    primary: 'grad-primary text-white shadow-lg hover:brightness-110',
    amber: 'text-white shadow-lg hover:brightness-110',
    ghost: 'bg-surface text-txt-2 border border-line hover:shadow-md'
};

const TONE_STYLE: Record<string, React.CSSProperties> = {
    amber: { background: 'var(--amber)' }
};

const ICON_BG: Record<string, string> = {
    primary: 'bg-white/20',
    amber: 'bg-white/20',
    ghost: 'bg-surface-2'
};

export const QuickActions: React.FC<QuickActionsProps> = ({ actions }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((a) => {
            const tone = a.tone || 'ghost';
            const Icon = a.icon;
            return (
                <button
                    key={a.label}
                    onClick={a.onClick}
                    className={`p-4 rounded-xl transition-all active:scale-95 flex flex-col items-center justify-center gap-2 group ${TONE[tone]}`}
                    style={TONE_STYLE[tone]}
                >
                    <div className={`p-2 rounded-lg group-hover:scale-110 transition-transform ${ICON_BG[tone]}`}>
                        <Icon size={22} />
                    </div>
                    <span className="font-semibold text-sm">{a.label}</span>
                    {a.sublabel && <span className="text-[10px] opacity-75 text-center">{a.sublabel}</span>}
                </button>
            );
        })}
    </div>
);
