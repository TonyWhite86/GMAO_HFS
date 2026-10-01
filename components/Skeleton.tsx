import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rect' }) => {
    const variantClasses = {
        text: 'h-4 w-3/4 rounded',
        rect: 'rounded-xl',
        circle: 'rounded-full'
    }[variant];

    return (
        <div
            className={`animate-pulse bg-slate-200 dark:bg-slate-700/50 ${variantClasses} ${className}`}
        />
    );
};
