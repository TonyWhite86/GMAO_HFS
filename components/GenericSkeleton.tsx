import React from 'react';
import { Skeleton } from './Skeleton';

export const GenericSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in p-2">
            <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>

            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-white dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            <Skeleton className="w-12 h-12 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                            <Skeleton className="w-16 h-8 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
