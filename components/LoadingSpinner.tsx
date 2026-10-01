import React from 'react';

export const LoadingSpinner: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] w-full bg-slate-100 dark:bg-slate-800 transition-colors">
            <div className="relative w-16 h-16">
                <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-slate-200 dark:border-slate-700"></div>
                <div className="absolute top-0 left-0 right-0 bottom-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium animate-pulse">
                Cargando módulo...
            </p>
        </div>
    );
};
