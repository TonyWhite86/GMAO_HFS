import React from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineBannerProps {
    onRetry?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onRetry }) => {
    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm font-medium shadow-lg animate-slide-down">
            <WifiOff size={16} />
            <span>Sin conexión a internet</span>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="ml-2 underline hover:no-underline font-bold"
                >
                    Reintentar
                </button>
            )}
        </div>
    );
};
