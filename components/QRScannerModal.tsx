import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw, AlertTriangle } from 'lucide-react';

interface QRScannerModalProps {
    onClose: () => void;
    onScan: (result: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose, onScan }) => {
    const [error, setError] = useState<string | null>(null);
    const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
    const scannerRef = useRef<any>(null);
    const regionId = "html5-qrcode-reader";
    const isScanningRef = useRef(false);

    // 1. Check for library availability with polling
    useEffect(() => {
        let attempts = 0;
        const checkLibrary = setInterval(() => {
            if (window.Html5Qrcode) {
                setIsLibraryLoaded(true);
                clearInterval(checkLibrary);
            } else {
                attempts++;
                if (attempts > 50) { // 5 seconds timeout
                    clearInterval(checkLibrary);
                    setError("La librería del escáner no pudo cargarse. Comprueba tu conexión.");
                }
            }
        }, 100);

        return () => clearInterval(checkLibrary);
    }, []);

    // 2. Initialize Scanner when ready
    useEffect(() => {
        if (!isLibraryLoaded || error) return;

        // Cleanup any previous instance just in case
        if (scannerRef.current) {
            try {
                if (isScanningRef.current) {
                    scannerRef.current.stop().catch((e: any) => console.warn(e));
                }
                scannerRef.current.clear();
            } catch (e) {
                console.warn("Cleanup error", e);
            }
        }

        const startScanner = async () => {
            // Wait a tick to ensure DOM is ready
            await new Promise(r => setTimeout(r, 100));

            try {
                const scanner = new window.Html5Qrcode(regionId);
                scannerRef.current = scanner;

                const config = { fps: 10, qrbox: { width: 250, height: 250 } };

                await scanner.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText: string) => {
                        // PREVENT MULTIPLE SCANS
                        if (!isScanningRef.current) return;

                        // Success
                        onScan(decodedText);
                        // Stop scanning immediately
                        stopScanner();
                    },
                    (errorMessage: string) => {
                        // ignore
                    }
                );
                isScanningRef.current = true;
            } catch (err) {
                console.error("Scanner Start Error", err);
                // Handle "camera already in use" or permission denied
                setError("No se pudo iniciar la cámara. Asegúrate de dar permisos.");
            }
        };

        startScanner();

        return () => {
            stopScanner();
        };
    }, [isLibraryLoaded]);

    const stopScanner = async () => {
        isScanningRef.current = false;
        if (scannerRef.current) {
            try {
                // Check if it is running before stopping (library might throw if not running)
                // Html5Qrcode doesn't have a simple isRunning check exposed easily, 
                // but usually stop() handles it or throws. 
                // We wrap in try-catch to be safe.
                await scannerRef.current.stop();
                await scannerRef.current.clear();
            } catch (err: any) {
                // Ignore stop errors (happens if already stopped)
                console.warn("Scanner stop warning:", err);
            }
            scannerRef.current = null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
                {/* Header */}
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Camera size={20} />
                        <span className="font-bold">Escanear QR</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Scanner Viewport */}
                <div className="relative bg-black min-h-[300px] flex flex-col">
                    {!isLibraryLoaded && !error ? (
                        <div className="flex-1 flex items-center justify-center text-white">
                            <RefreshCw className="animate-spin mr-2" /> Cargando librería...
                        </div>
                    ) : !error ? (
                        <div id={regionId} className="w-full h-full overflow-hidden bg-black"></div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center flex-1">
                            <AlertTriangle size={48} className="mb-4 text-red-500" />
                            <p className="mb-4 text-red-400">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-bold flex items-center gap-2"
                            >
                                <RefreshCw size={16} /> Recargar Página
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Instructions */}
                <div className="p-4 bg-slate-100 dark:bg-slate-700 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Asegúrate de que haya suficiente luz.
                    </p>
                </div>
            </div>
        </div>
    );
};
