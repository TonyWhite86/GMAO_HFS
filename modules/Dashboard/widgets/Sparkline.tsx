import React from 'react';

interface SparklineProps {
    data: number[];
    color?: string;
    label?: string;
    height?: number;
    /** Segunda serie (p.ej. completadas) dibujada más tenue. */
    data2?: number[];
}

/** Mini-gráfica SVG sin dependencias. */
export const Sparkline: React.FC<SparklineProps> = ({
    data, data2, color = 'var(--accent)', label, height = 40
}) => {
    const width = 120;
    const all = [...data, ...(data2 || [])];
    const max = Math.max(1, ...all);
    const points = (series: number[]): string => {
        if (series.length < 2) return '';
        const step = width / (series.length - 1);
        return series
            .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`)
            .join(' ');
    };

    return (
        <div className="flex items-center gap-2">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
                {data2 && (
                    <polyline
                        points={points(data2)}
                        fill="none"
                        stroke={color}
                        strokeOpacity={0.35}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                )}
                <polyline
                    points={points(data)}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            </svg>
            {label && <span className="text-[10px] text-txt-3 whitespace-nowrap">{label}</span>}
        </div>
    );
};
