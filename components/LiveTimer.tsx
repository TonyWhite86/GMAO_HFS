import React, { useState, useEffect, useMemo } from 'react';
import { WOStatus } from '../types';
import { computeActiveSeconds } from '../utils/timeTracking';

interface LiveTimerProps {
    status: WOStatus;
    statusHistory?: { status: WOStatus; timestamp: string }[];
    timeSpentMinutes?: number;
}

export const LiveTimer: React.FC<LiveTimerProps> = ({ status, statusHistory, timeSpentMinutes }) => {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (status !== WOStatus.IN_PROGRESS) return;
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [status]);

    const totalSeconds = useMemo(() => {
        if (status === WOStatus.COMPLETED) return (timeSpentMinutes || 0) * 60;
        return computeActiveSeconds(status, statusHistory, timeSpentMinutes);
    }, [status, statusHistory, timeSpentMinutes, tick]);

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    return <>{`${h}h ${m}m${status === WOStatus.IN_PROGRESS ? ` ${s}s` : ''}`}</>;
};
