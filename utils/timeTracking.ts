import { WOStatus } from '../types';

export interface StatusHistoryEntry {
  status: WOStatus;
  timestamp: string;
}

export interface TimeSession {
  start: Date;
  end: Date;
  isActive: boolean;
}

// Pairs IN_PROGRESS entries with their closing entries. An open session at the
// end is closed with `now` and flagged as active.
export const extractTimeSessions = (history?: StatusHistoryEntry[] | null): TimeSession[] => {
  if (!history || history.length === 0) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const sessions: TimeSession[] = [];
  let openStart: number | null = null;

  for (const entry of sorted) {
    const t = new Date(entry.timestamp).getTime();
    if (entry.status === WOStatus.IN_PROGRESS) {
      if (openStart === null) openStart = t;
    } else {
      if (openStart !== null) {
        sessions.push({ start: new Date(openStart), end: new Date(t), isActive: false });
        openStart = null;
      }
    }
  }

  if (openStart !== null) {
    sessions.push({ start: new Date(openStart), end: new Date(), isActive: true });
  }

  return sessions;
};

// Source of truth for elapsed time. When history exists it is derived purely
// from history (never mixing in savedMinutes), so there is no double counting.
// savedMinutes is only used as fallback for legacy rows without history.
export const computeActiveSeconds = (
  status: WOStatus,
  history?: StatusHistoryEntry[] | null,
  savedMinutes?: number
): number => {
  if (!history || history.length === 0) return (savedMinutes || 0) * 60;

  const sessions = extractTimeSessions(history);
  let totalMs = 0;

  for (const s of sessions) {
    if (s.isActive) {
      if (status === WOStatus.IN_PROGRESS) totalMs += Date.now() - s.start.getTime();
    } else {
      totalMs += s.end.getTime() - s.start.getTime();
    }
  }

  return Math.floor(totalMs / 1000);
};

export const computeActiveMinutes = (
  status: WOStatus,
  history?: StatusHistoryEntry[] | null,
  savedMinutes?: number
): number => Math.floor(computeActiveSeconds(status, history, savedMinutes) / 60);

// True when the WO has an open work session (status IN_PROGRESS and the history
// ends with an IN_PROGRESS entry). Used to distinguish "running" from "paused".
export const hasActiveSession = (history?: StatusHistoryEntry[] | null): boolean => {
  const sessions = extractTimeSessions(history);
  return sessions.length > 0 && sessions[sessions.length - 1].isActive;
};

// Overlap between a session and a calendar day. Returns null if the session
// does not touch that day. Handles night shifts: a session 22:00->06:00
// yields 22:00->24:00 on day 1 and 00:00->06:00 on day 2.
export const getDayOverlap = (
  session: TimeSession,
  dayStart: Date
): { start: Date; end: Date } | null => {
  const startOfDay = new Date(dayStart);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dayStart);
  endOfDay.setHours(23, 59, 59, 999);

  const s = Math.max(session.start.getTime(), startOfDay.getTime());
  const e = Math.min(session.end.getTime(), endOfDay.getTime());
  if (s >= e) return null;
  return { start: new Date(s), end: new Date(e) };
};

export const formatDuration = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};
