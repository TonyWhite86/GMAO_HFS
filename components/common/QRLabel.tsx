import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Download, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    QRLabelData, renderLabelBlob, copyLabelToClipboard, downloadLabelBlob,
    printLabelBlob, labelFileName
} from '../../utils/qrLabel';

interface QRLabelProps {
    value: string;
    code: string;
    name: string;
    stock?: number | string | null;
    /** Solo la fila de acciones (sin vista previa del QR). */
    compact?: boolean;
}

export const QRLabel: React.FC<QRLabelProps> = ({ value, code, name, stock, compact = false }) => {
    const qrRef = useRef<HTMLDivElement>(null);
    const [isBusy, setIsBusy] = useState(false);

    const data: QRLabelData = { value, code, name, stock };

    const buildBlob = async (): Promise<Blob | null> => {
        const svg = qrRef.current?.querySelector('svg');
        if (!svg) {
            toast.error('No se pudo generar la etiqueta');
            return null;
        }
        const markup = new XMLSerializer().serializeToString(svg);
        try {
            return await renderLabelBlob(markup, data);
        } catch {
            toast.error('No se pudo generar la etiqueta');
            return null;
        }
    };

    const handleCopy = async () => {
        setIsBusy(true);
        try {
            const blob = await buildBlob();
            if (!blob) return;
            const ok = await copyLabelToClipboard(blob);
            if (ok) {
                toast.success('Etiqueta copiada al portapapeles');
            } else {
                downloadLabelBlob(blob, labelFileName(data));
                toast.info('Tu navegador no permite copiar imágenes: etiqueta descargada');
            }
        } finally {
            setIsBusy(false);
        }
    };

    const handleDownload = async () => {
        setIsBusy(true);
        try {
            const blob = await buildBlob();
            if (!blob) return;
            downloadLabelBlob(blob, labelFileName(data));
            toast.success('Etiqueta descargada');
        } finally {
            setIsBusy(false);
        }
    };

    const handlePrint = async () => {
        setIsBusy(true);
        try {
            const blob = await buildBlob();
            if (!blob) return;
            printLabelBlob(blob, `Etiqueta ${code || name}`);
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            {/* El QR siempre está renderizado (fuente para serializar); en modo
                compacto queda oculto pero medible. */}
            <div ref={qrRef} className={compact ? 'w-0 h-0 overflow-hidden' : 'shrink-0'}>
                <QRCodeSVG value={value} size={compact ? 120 : 120} level="M" includeMargin={false} />
            </div>

            {!compact && (
                <div className="min-w-0 flex-1">
                    <div className="text-xs text-txt-3 font-mono">Código QR</div>
                    <div className="font-mono text-sm font-bold text-txt-2 truncate">{code || value}</div>
                    {stock !== null && stock !== undefined && stock !== '' && (
                        <div className="text-xs font-bold text-ok mt-0.5">Stock: {stock}</div>
                    )}
                </div>
            )}

            <div className={`flex items-center gap-1.5 ${compact ? '' : 'flex-wrap'}`}>
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={isBusy}
                    className="btn btn-accent-ghost btn-sm"
                    title="Copiar etiqueta como imagen"
                >
                    {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                    Copiar
                </button>
                <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isBusy}
                    className="btn btn-ghost btn-sm"
                    title="Descargar etiqueta en PNG"
                >
                    <Download size={13} />
                    PNG
                </button>
                <button
                    type="button"
                    onClick={handlePrint}
                    disabled={isBusy}
                    className="btn btn-ghost btn-sm"
                    title="Imprimir etiqueta"
                >
                    <Printer size={13} />
                    Imprimir
                </button>
            </div>
        </div>
    );
};
