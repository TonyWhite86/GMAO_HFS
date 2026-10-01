import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer, Download } from 'lucide-react';
import { Equipment } from '../../../types';

interface QRDisplayProps {
    equipment: Equipment;
    onClose: () => void;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({ equipment, onClose }) => {
    const downloadQR = () => {
        const svg = document.getElementById('qr-code-svg');
        if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                const pngFile = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.download = `QR-${equipment.code || equipment.name}.png`;
                downloadLink.href = pngFile;
                downloadLink.click();
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        }
    };

    const printQR = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir QR - ${equipment.name}</title>
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .qr-container { text-align: center; border: 2px solid #000; padding: 20px; border-radius: 10px; }
              h2 { font-family: sans-serif; margin-bottom: 20px; }
              p { font-family: sans-serif; margin-top: 10px; color: #666; }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h2>${equipment.name}</h2>
              ${document.getElementById('qr-code-container')?.innerHTML}
              <p>${equipment.code || equipment.qrCode}</p>
            </div>
            <script>
              window.onload = () => { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
            printWindow.document.close();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-700 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center relative animate-fade-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{equipment.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-mono">{equipment.code || equipment.qrCode}</p>

                <div className="bg-white p-4 rounded-xl shadow-inner inline-block mb-6" id="qr-code-container">
                    <QRCodeSVG
                        id="qr-code-svg"
                        value={equipment.qrCode}
                        size={200}
                        level="H"
                        includeMargin={true}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={printQR}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
                    >
                        <Printer size={18} />
                        Imprimir
                    </button>
                    <button
                        onClick={downloadQR}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Download size={18} />
                        Descargar
                    </button>
                </div>
            </div>
        </div>
    );
};
