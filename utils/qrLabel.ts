/**
 * Etiqueta QR imprimible: QR + código + nombre (+ stock), compuesta en canvas
 * para poder copiarla como imagen, descargarla en PNG o imprimirla.
 */

export interface QRLabelData {
    value: string;        // contenido del QR (qrCode / sku)
    code: string;         // código visible bajo el QR
    name: string;         // nombre del equipo o repuesto
    stock?: number | string | null;
}

/** Nombre de archivo seguro para la etiqueta. */
export const labelFileName = (data: QRLabelData): string => {
    const base = (data.code || data.name || 'etiqueta')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    return `etiqueta-${base || 'qr'}.png`;
};

/** Texto de stock para la etiqueta (null si no hay stock que enseñar). */
export const formatStockLabel = (stock?: number | string | null): string | null => {
    if (stock === null || stock === undefined || stock === '') return null;
    return `Stock: ${stock}`;
};

/** Escala el SVG del QR a `size` px y lo rasteriza como imagen. */
const svgToImage = (svgMarkup: string, size: number): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const sized = svgMarkup.replace(
        /<svg([^>]*)>/,
        (_m, attrs: string) => {
            const cleaned = attrs
                .replace(/\swidth="[^"]*"/, '')
                .replace(/\sheight="[^"]*"/, '');
            return `<svg${cleaned} width="${size}" height="${size}">`;
        }
    );
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo rasterizar el QR'));
    // encodeURIComponent soporta SVG con acentos (btoa fallaría con UTF-8)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
});

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
        const candidate = current ? `${current} ${w}` : w;
        if (ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = w;
        }
        if (lines.length === maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length === maxLines && current && words.join(' ').length > lines.join(' ').length) {
        lines[maxLines - 1] = lines[maxLines - 1].replace(/.{1}$/, '…');
    }
    return lines;
};

/** Compone la etiqueta completa en un canvas y devuelve el PNG. */
export const renderLabelBlob = async (qrSvgMarkup: string, data: QRLabelData): Promise<Blob> => {
    const W = 340;
    const qrSize = 200;
    const qrImg = await svgToImage(qrSvgMarkup, qrSize);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    // Altura estimada según líneas del nombre (se vuelve a medir tras setear fuente)
    canvas.width = W;
    canvas.height = 420;

    // Fondo blanco con borde
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, W - 6, canvas.height - 6);

    // Nombre (hasta 2 líneas)
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, data.name || '', W - 48, 2);
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 36 + i * 26));

    // QR
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrImg, (W - qrSize) / 2, 96, qrSize, qrSize);

    // Código (mono)
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 18px Consolas, monospace';
    ctx.fillText(data.code || data.value, W / 2, 324);

    // Stock
    const stockLabel = formatStockLabel(data.stock);
    if (stockLabel) {
        ctx.fillStyle = '#0f766e';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText(stockLabel, W / 2, 356);
    }

    // Pie
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('Etiqueta generada desde Mantenimiento', W / 2, canvas.height - 22);

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG')), 'image/png');
    });
};

/** Copia la etiqueta al portapapeles como imagen. Devuelve false si el navegador no lo soporta. */
export const copyLabelToClipboard = async (blob: Blob): Promise<boolean> => {
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !('write' in navigator.clipboard)) {
        return false;
    }
    try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return true;
    } catch {
        return false;
    }
};

/** Descarga la etiqueta como PNG. */
export const downloadLabelBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** Imprime la etiqueta (ventana con la imagen). */
export const printLabelBlob = (blob: Blob, title: string): void => {
    const url = URL.createObjectURL(blob);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
        <html>
          <head>
            <title>${title.replace(/[<>]/g, '')}</title>
            <style>
              body { display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              img { max-width: 100%; }
            </style>
          </head>
          <body>
            <img src="${url}" alt="Etiqueta" />
            <script>
              window.onload = () => { window.print(); window.close(); }
            </script>
          </body>
        </html>
    `);
    w.document.close();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
};
