import React, { useMemo, useState, useEffect } from 'react';
import { WorkOrder, User, UserRole } from '../../types';
import { WO_TYPE_CONFIG } from '../../constants';
import { extractTimeSessions, getDayOverlap, formatDuration } from '../../utils/timeTracking';
import { useIsMobile } from '../../hooks/useMediaQuery';

export interface WorkSession {
  woId: string;
  woTitle: string;
  woType: string;
  userId: string;
  start: Date;
  end: Date;
  isActive: boolean;
  /** Tiempo escrito a mano (no medido por sesiones de status_history). */
  isManual?: boolean;
}

interface Props {
  workOrders: WorkOrder[];
  users: User[];
  currentUser: User;
  currentDate: Date;
  viewMode: 'day' | 'week';
  showSunday: boolean;
  onSelectWO: (wo: WorkOrder) => void;
}

export const extractSessions = (wo: WorkOrder): WorkSession[] => {
  const base = extractTimeSessions(wo.statusHistory);

  const userIds = new Set<string>();
  if (wo.assignedUserId) userIds.add(wo.assignedUserId);
  (wo.collaborators || []).forEach(id => userIds.add(id));
  // Una OT sin asignar (p.ej. un preventivo recién lanzado) no tendría a quién
  // atribuirle el bloque y no aparecería en el parte. Usamos quien registró el
  // tiempo como responsable del trabajo.
  if (userIds.size === 0 && wo.timeRecordedBy) userIds.add(wo.timeRecordedBy);

  const sessions: WorkSession[] = [];

  // Tiempo MANUAL: una OT completada sin "Iniciar" no tiene sesiones en
  // status_history, así que el Gantt se quedaba vacío aunque el usuario hubiera
  // indicado minutos. Sintetizamos un bloque del tamaño del tiempo registrado,
  // terminando en el cierre (o en el momento en que se apuntó).
  if (wo.timeSource === 'manual' && (wo.timeSpentMinutes || 0) > 0) {
    const minutes = wo.timeSpentMinutes as number;
    const end = new Date(wo.closedAt || wo.timeRecordedAt || wo.scheduledDate || wo.createdAt);
    const start = new Date(end.getTime() - minutes * 60000);
    userIds.forEach(uid => {
      sessions.push({
        woId: wo.id,
        woTitle: wo.title,
        woType: wo.type,
        userId: uid,
        start,
        end,
        isActive: false,
        isManual: true,
      });
    });
    return sessions;
  }

  if (base.length === 0) return [];

  base.forEach(b => {
    userIds.forEach(uid => {
      sessions.push({
        woId: wo.id,
        woTitle: wo.title,
        woType: wo.type,
        userId: uid,
        start: b.start,
        end: b.end,
        isActive: b.isActive,
        isManual: false,
      });
    });
  });

  return sessions;
};

const WO_COLORS: Record<string, string> = {
  'Correctivo': 'bg-accent border-accent',
  'Preventivo': 'bg-spec border-spec',
  'Actuación Programada': 'bg-warn border-warn',
};

// Diffused (gradient) backgrounds for the weekly cards, tinted by WO type.
const WO_GRADIENTS: Record<string, string> = {
  'Correctivo': 'bg-gradient-to-br from-accent/25 via-accent/10 to-transparent',
  'Preventivo': 'bg-gradient-to-br from-spec/25 via-spec/10 to-transparent',
  'Actuación Programada': 'bg-gradient-to-br from-warn/25 via-warn/10 to-transparent',
};

const HOUR_MS = 60 * 60 * 1000;

const formatTime = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export const WorkLogGantt: React.FC<Props> = ({
  workOrders, users, currentUser, currentDate, viewMode, showSunday, onSelectWO
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isManager = currentUser.role === UserRole.SECTION_MANAGER;
  const isTechnicianOnly = currentUser.role === UserRole.TECHNICIAN;
  const isMobile = useIsMobile();

  // Local clock tick: re-renders every 30s so active sessions' end (Date.now()
  // from extractTimeSessions) and minute totals stay fresh. Pure client-side,
  // zero DB queries. External changes still arrive via the realtime subscription.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // 1. Extract all sessions from all WOs
  const allSessions = useMemo(() => {
    const s: WorkSession[] = [];
    workOrders.forEach(wo => {
      extractSessions(wo).forEach(session => s.push(session));
    });
    return s;
  }, [workOrders, tick]);

  // 2. Time range
  const timeRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(currentDate);
      monday.setDate(diff);
      start.setTime(monday.getTime());
      start.setHours(0, 0, 0, 0);
      const daysCount = showSunday ? 7 : 6;
      end.setTime(monday.getTime());
      end.setDate(monday.getDate() + daysCount - 1);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [currentDate, viewMode, showSunday]);

  const filteredSessions = useMemo(() => {
    return allSessions.filter(s => {
      return s.start < timeRange.end && s.end > timeRange.start;
    });
  }, [allSessions, timeRange]);

  // 3. Visible users
  const visibleUsers = useMemo(() => {
    let pool = users.filter(u => u.role === UserRole.TECHNICIAN || u.role === UserRole.SECTION_MANAGER);

    if (isTechnicianOnly) {
      pool = pool.filter(u => u.id === currentUser.id);
    } else if (isManager) {
      pool = pool.filter(u => u.sections.some(s => currentUser.sections.includes(s)) || u.id === currentUser.id);
    }

    return pool;
  }, [users, currentUser, isAdmin, isManager, isTechnicianOnly]);

  // 4. Day columns for week view
  const dayColumns = useMemo(() => {
    if (viewMode === 'week') {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(currentDate);
      monday.setDate(diff);
      const daysCount = showSunday ? 7 : 6;
      return Array.from({ length: daysCount }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
      });
    }
    return [];
  }, [viewMode, currentDate, showSunday]);

  const totalColumns = viewMode === 'day' ? 1 : dayColumns.length;

  const rangeMs = timeRange.end.getTime() - timeRange.start.getTime();

  const getBarStyle = (session: WorkSession): React.CSSProperties => {
    const sessionStart = Math.max(session.start.getTime(), timeRange.start.getTime());
    const sessionEnd = Math.min(session.end.getTime(), timeRange.end.getTime());
    const leftPct = ((sessionStart - timeRange.start.getTime()) / rangeMs) * 100;
    const widthPct = ((sessionEnd - sessionStart) / rangeMs) * 100;
    return {
      left: `${leftPct}%`,
      width: `${Math.max(widthPct, 0.3)}%`,
    };
  };

  // Hour columns for day view (every hour 0-24)
  const hourColumns = useMemo(() => {
    if (viewMode === 'day') {
      const cols: { hour: number; left: string }[] = [];
      for (let h = 0; h <= 24; h++) {
        const left = ((h * HOUR_MS) / rangeMs) * 100;
        cols.push({ hour: h, left: `${left}%` });
      }
      return cols;
    }
    return [];
  }, [viewMode, rangeMs]);

  return (
    <div className="bg-surface rounded-lg border border-line shadow-sm overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-line">
        <h3 className="font-bold text-txt-2">
          Parte de Trabajo
        </h3>
        {isTechnicianOnly && (
          <span className="text-xs text-txt-3">(Solo mis registros)</span>
        )}
        {filteredSessions.length > 0 && (
          <span className="text-xs text-txt-3 ml-auto">
            {filteredSessions.length} sesion{filteredSessions.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>

      {visibleUsers.length === 0 ? (
        <div className="text-center py-12 text-txt-3">
          {isTechnicianOnly ? 'No hay registros de trabajo' : 'No hay técnicos disponibles'}
        </div>
      ) : isMobile ? (
        /* Mobile: simple per-day list of sessions (the timeline is not usable on small screens) */
        <div className="p-3 space-y-3">
          {visibleUsers.map(user => {
            const userSessions = filteredSessions.filter(s => s.userId === user.id);
            const daySessions = userSessions
              .map(s => {
                const overlap = getDayOverlap(s, timeRange.start);
                return overlap ? { ...s, start: overlap.start, end: overlap.end } : null;
              })
              .filter((s): s is WorkSession => s !== null);
            const totalMin = userSessions.reduce(
              (acc, s) => acc + Math.round((s.end.getTime() - s.start.getTime()) / 60000),
              0
            );

            return (
              <div key={user.id} className="bg-surface rounded-lg border border-line overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-2 border-b border-line">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-2 to-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-txt-2 truncate">{user.name}</div>
                  </div>
                  <div className="text-[10px] font-medium text-txt-2">{formatDuration(totalMin)}</div>
                </div>

                <div className="p-2 space-y-2">
                  {daySessions.length === 0 ? (
                    <div className="text-center text-[11px] text-txt-3 italic py-3">Sin registro</div>
                  ) : (
                    daySessions.map((session, si) => {
                      const wo = workOrders.find(w => w.id === session.woId);
                      const durationMin = Math.round((session.end.getTime() - session.start.getTime()) / 60000);
                      const typeCfg = WO_TYPE_CONFIG[session.woType as keyof typeof WO_TYPE_CONFIG];
                      const colorClass = WO_COLORS[session.woType] || 'bg-surface-20';
                      return (
                        <button
                          key={si}
                          onClick={() => wo && onSelectWO(wo)}
                          className="w-full text-left flex items-center gap-2 p-2 rounded-lg border border-line bg-surface hover:bg-surface-2 transition-colors active:scale-[0.98]"
                        >
                          <div className={`w-1.5 self-stretch rounded ${colorClass.split(' ')[0]}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-txt truncate">{session.woTitle}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-txt-2">
                                {formatTime(session.start)} – {formatTime(session.end)}
                              </span>
                              {session.isActive && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-ok">
                                  <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" /> En curso
                                </span>
                              )}
                              {session.isManual && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-warn">
                                  ⚠ Manual
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[11px] font-bold text-txt-2">{formatDuration(durationMin)}</div>
                            <div className="text-[9px] text-txt-3">{typeCfg ? typeCfg.label : session.woType}</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-w-[600px]">
          {/* Time header row */}
          <div className="grid border-b border-line bg-surface-2"
            style={{ gridTemplateColumns: `160px repeat(${totalColumns}, 1fr)` }}
          >
            <div className="p-2 text-xs font-semibold text-txt-2 border-r border-line">
              Técnico
            </div>
            {viewMode === 'day' ? (
              <div className="relative h-8 border-r border-line">
                {hourColumns.map(m => (
                  <div
                    key={m.hour}
                    className="absolute top-0 h-full border-l border-line"
                    style={{ left: m.left }}
                  >
                    {m.hour < 24 && (
                      <span className="text-[9px] text-txt-2 ml-0.5">{m.hour.toString().padStart(2, '0')}:00</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              dayColumns.map((d, i) => (
                <div key={i} className={`p-1 text-[10px] text-center font-medium border-r border-line last:border-r-0 ${d.getDay() === 0 ? 'text-ko' : 'text-txt-2'}`}>
                  <div>{d.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                  <div className="text-[9px] opacity-70">{d.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' })}</div>
                </div>
              ))
            )}
          </div>

          {/* User rows */}
          {visibleUsers.map(user => {
            const userSessions = filteredSessions.filter(s => s.userId === user.id);

            return (
              <div key={user.id}
                className="grid border-b border-line last:border-b-0"
                style={{ gridTemplateColumns: `160px repeat(${totalColumns}, 1fr)` }}
              >
                {/* User label */}
                <div className="p-2 border-r border-line flex items-center gap-2 bg-surface">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-2 to-accent flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-txt-2 truncate">{user.name}</div>
                    <div className="text-[9px] text-txt-3">
                      {formatDuration(userSessions.reduce((acc, s) => acc + Math.round((s.end.getTime() - s.start.getTime()) / 60000), 0))}
                    </div>
                  </div>
                </div>

                {/* Day view: single timeline column */}
                {viewMode === 'day' && (
                  <div className="relative min-h-[60px] bg-surface border-r border-line">
                    {/* Hour column lines */}
                    {hourColumns.map(m => (
                      <div
                        key={m.hour}
                        className="absolute top-0 h-full border-l border-line/50"
                        style={{ left: m.left, zIndex: 0 }}
                      />
                    ))}
                    {/* Bars */}
                    {userSessions.map((session, si) => {
                      const style = getBarStyle(session);
                      const clippedStart = Math.max(session.start.getTime(), timeRange.start.getTime());
                      const clippedEnd = Math.min(session.end.getTime(), timeRange.end.getTime());
                      const durationMin = Math.round((clippedEnd - clippedStart) / 60000);
                      const colorClass = WO_COLORS[session.woType] || 'bg-surface-20';
                      return (
                        <div
                          key={si}
                          onClick={() => {
                            const wo = workOrders.find(w => w.id === session.woId);
                            if (wo) onSelectWO(wo);
                          }}
                          className={`absolute top-1 h-6 rounded-sm ${colorClass} bg-opacity-80 border cursor-pointer hover:opacity-90 transition-opacity shadow-sm min-w-[3px] z-10 ${session.isManual ? 'border-dashed border-2 border-amber-400 opacity-80' : ''}`}
                          style={{
                            left: style.left,
                            width: style.width,
                          }}
                          title={`${session.woTitle} (${formatDuration(durationMin)})${session.isManual ? ' · tiempo registrado a mano' : ''}`}
                        >
                          <div className="flex items-center gap-1 px-1 h-full overflow-hidden">
                            {parseFloat(style.width as string) > 5 && (
                              <>
                                <span className="text-[8px] text-white font-semibold truncate">{session.woTitle}</span>
                                <span className="text-[7px] text-white/80 shrink-0">{formatDuration(durationMin)}</span>
                              </>
                            )}
                            {session.isActive && (
                              <span className="w-1 h-1 rounded-full bg-surface animate-pulse shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* "No work" indicator */}
                    {userSessions.length === 0 && (
                      <div className="flex items-center justify-center h-full text-[10px] text-txt-3 italic">
                        Sin registro
                      </div>
                    )}
                  </div>
                )}

                {/* Week view: one column per day. Sessions are grouped by WO and
                    their times summed, so a paused+resumed WO shows one card with
                    the day total. The per-session detail lives in the day view. */}
                {viewMode === 'week' && dayColumns.map((d, ci) => {
                  const sessionsInDay = userSessions
                    .map(s => {
                      const overlap = getDayOverlap(s, d);
                      return overlap ? { ...s, start: overlap.start, end: overlap.end } : null;
                    })
                    .filter((s): s is WorkSession => s !== null);

                  // Group sessions by WO within the day (preserves chronological order)
                  const grouped = new Map<string, WorkSession[]>();
                  sessionsInDay.forEach(s => {
                    const list = grouped.get(s.woId) || [];
                    list.push(s);
                    grouped.set(s.woId, list);
                  });

                  return (
                    <div key={ci}
                      className="flex flex-col gap-1 p-1 border-r border-line last:border-r-0 min-h-[60px] bg-surface"
                    >
                      {grouped.size === 0 ? (
                        <div className="flex items-center justify-center h-full text-[10px] text-txt-3 italic">
                          Sin registro
                        </div>
                      ) : (
                        Array.from(grouped.entries()).map(([woId, sessions]) => {
                          const first = sessions.reduce((a, b) => (b.start < a.start ? b : a));
                          const last = sessions.reduce((a, b) => (b.end > a.end ? b : a));
                          const totalMin = sessions.reduce(
                            (acc, s) => acc + Math.round((s.end.getTime() - s.start.getTime()) / 60000),
                            0
                          );
                          const typeCfg = WO_TYPE_CONFIG[sessions[0].woType as keyof typeof WO_TYPE_CONFIG];
                          const gradient = WO_GRADIENTS[sessions[0].woType] || 'bg-gradient-to-br from-txt-3/20 to-transparent';
                          const isActive = sessions.some(s => s.isActive);
                          return (
                            <div
                              key={woId}
                              onClick={() => {
                                const wo = workOrders.find(w => w.id === woId);
                                if (wo) onSelectWO(wo);
                              }}
                              className={`p-1 rounded text-[9px] cursor-pointer hover:opacity-80 transition-opacity shadow-sm border border-line overflow-hidden ${gradient}`}
                            >
                              <div className="font-semibold truncate text-txt-2">{sessions[0].woTitle}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {typeCfg && (
                                  <span className="text-[8px] px-1 rounded bg-surface/50">{typeCfg.label}</span>
                                )}
                                <span className="text-txt-3">{formatTime(first.start)}–{formatTime(last.end)}</span>
                                <span className="text-txt-2 font-bold">{formatDuration(totalMin)}</span>
                                {isActive && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                                )}
                                {sessions.some(s => s.isManual) && (
                                  <span className="text-[8px] font-bold text-warn">⚠ manual</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t border-line bg-surface-2">
        <span className="text-[10px] font-medium text-txt-2">Tipo:</span>
        {Object.entries(WO_COLORS).map(([type, cls]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${cls.split(' ')[0]}`} />
            <span className="text-[10px] text-txt-2">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
