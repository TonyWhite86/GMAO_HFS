import React from 'react';
import { Skeleton } from './Skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-40 rounded-lg" />
            </div>

            {/* Quick Actions Skeleton */}
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
            </div>

            {/* Task List Header Skeleton */}
            <div className="flex items-center gap-2 px-1">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-56" />
            </div>

            {/* Task Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
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
