import React from 'react';
import { Skeleton } from './Skeleton';

export const MaintenanceSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Search and Filters Skeleton */}
            <div className="bg-white dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex gap-2">
                    <Skeleton className="flex-1 h-11" />
                    <Skeleton className="w-11 h-11" />
                </div>
                <div className="flex gap-2 overflow-hidden">
                    <Skeleton className="h-8 w-24 rounded-full flex-shrink-0" />
                    <Skeleton className="h-8 w-28 rounded-full flex-shrink-0" />
                    <Skeleton className="h-8 w-20 rounded-full flex-shrink-0" />
                </div>
            </div>

            {/* Tab Header Skeleton */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
                <Skeleton className="h-10 w-32 border-b-2 border-blue-600" />
                <Skeleton className="h-10 w-32" />
            </div>

            {/* Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <div className="flex justify-between">
                            <Skeleton className="h-5 w-24 rounded-full" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                        <div className="flex gap-3">
                            <Skeleton className="w-1 h-12" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between">
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-20 rounded-lg" />
                                <Skeleton className="h-8 w-20 rounded-lg" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
