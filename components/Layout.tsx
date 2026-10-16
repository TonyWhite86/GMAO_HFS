import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Calendar, Box, Users, Wrench, LogOut, LayoutDashboard, BarChart3, Plus, AlertCircle, CalendarClock, Sun, Moon, Palette } from 'lucide-react';
import { BRANDING } from '../branding';
import { useAppStore } from '../store/useAppStore';
import { WOStatus, IncidentStatus } from '../types';
import { useRestrictedItems } from '../hooks/useFilteredData';
import { canSeeIncident } from '../utils/incidentVisibility';
import { usePermissions } from '../hooks/usePermissions';
import { ThemeId } from '../store/slices/createUISlice';

interface LayoutProps {
  children: React.ReactNode;
}

const THEME_OPTIONS: { id: ThemeId; label: string; swatch: string; ring: boolean }[] = [
  { id: 'azul', label: 'Azul', swatch: '#2563eb', ring: true },
  { id: 'claro', label: 'Claro', swatch: '#e9ecef', ring: true },
  { id: 'oscuro', label: 'Oscuro', swatch: '#0f1117', ring: true },
  { id: 'suave', label: 'Suave', swatch: '#c2764a', ring: true },
];

const Clock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span className="text-[11px] font-medium" style={{ color: 'var(--topbar-sub)' }}>
        {now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
      <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--topbar-text)' }}>
        {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
};

const ThemeSelector: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  return (
    <div className={`flex items-center gap-1.5 ${compact ? '' : 'mt-2.5'}`}>
      {!compact && (
        <Palette size={13} className="shrink-0" style={{ color: 'var(--sidebar-text3)' }} />
      )}
      {THEME_OPTIONS.map(t => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={`Tema ${t.label}`}
          aria-label={`Tema ${t.label}`}
          aria-pressed={theme === t.id}
          className="w-[18px] h-[18px] rounded-full border transition-transform hover:scale-110 active:scale-95"
          style={{
            background: t.swatch,
            borderColor: 'rgba(255,255,255,.35)',
            boxShadow: theme === t.id ? '0 0 0 2px var(--sidebar-logo-color)' : 'none',
          }}
        />
      ))}
    </div>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    currentUser,
    activeModule,
    setActiveModule,
    logout,
    setCreationMode
  } = useAppStore();

  const userPermissions = useAppStore(s => s.userPermissions);
  const workOrders = useAppStore(s => s.workOrders);
  const inventory = useAppStore(s => s.inventory);
  const incidents = useAppStore(s => s.incidents);
  const incidentCategories = useAppStore(s => s.incidentCategories);
  const catalogSections = useAppStore(s => s.sections);

  const canAccessInventory = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    const perm = userPermissions.find(p => p.userId === currentUser.id && p.module === 'inventory');
    return (perm?.level ?? 'sin_acceso') !== 'sin_acceso';
  }, [userPermissions, currentUser?.id, currentUser?.role]);

  const { canViewStoppages } = usePermissions(currentUser);

  // Notification badges (scoped to what the current user can actually see)
  const visibleWorkOrders = useRestrictedItems(
    workOrders,
    currentUser,
    (wo) => [wo.section, ...(wo.collaboratingSections || [])],
    (wo, user) => wo.assignedUserId === user.id || (wo.collaborators || []).includes(user.id)
  );
  const visibleIncidents = useMemo(
    () => incidents.filter(inc => canSeeIncident(inc, currentUser, incidentCategories, catalogSections)),
    [incidents, currentUser, incidentCategories, catalogSections]
  );

  const unassignedCount = useMemo(
    () => visibleWorkOrders.filter(wo => !wo.assignedUserId && wo.status !== WOStatus.COMPLETED).length,
    [visibleWorkOrders]
  );
  const lowStockCount = useMemo(
    () => inventory.filter(i => i.status === 'Active' && i.quantity <= i.minStock).length,
    [inventory]
  );
  const openIncidentCount = useMemo(
    () => visibleIncidents.filter(i => i.status === IncidentStatus.OPEN).length,
    [visibleIncidents]
  );

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  // Safety check if user is null (should only happen if redirected to login)
  if (!currentUser) return null;

  const isObserver = currentUser.role === 'Observador N1' || currentUser.role === 'Observador N2';

  const navSections: { label: string; items: { id: string; label: string; icon: React.ElementType; restricted: boolean }[] }[] = [
    {
      label: 'Principal',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, restricted: isObserver },
      ],
    },
    {
      label: 'Operación',
      items: [
        { id: 'maintenance', label: 'Mantenimiento', icon: ClipboardList, restricted: isObserver },
        { id: 'scheduler', label: 'Programador', icon: Calendar, restricted: isObserver },
        { id: 'stoppages', label: 'Paradas', icon: CalendarClock, restricted: !canViewStoppages },
        { id: 'incidents', label: 'Incidencias', icon: AlertCircle, restricted: false },
      ],
    },
    {
      label: 'Activos',
      items: [
        { id: 'equipment', label: 'Equipos', icon: Wrench, restricted: isObserver },
        { id: 'inventory', label: 'Inventario', icon: Box, restricted: !canAccessInventory },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { id: 'reports', label: 'Informes', icon: BarChart3, restricted: currentUser.role === 'Técnico' || isObserver },
        { id: 'users', label: 'Usuarios', icon: Users, restricted: currentUser.role !== 'Admin' },
      ],
    },
  ];

  const badgeCounts: Record<string, number> = {
    maintenance: unassignedCount,
    inventory: lowStockCount,
    incidents: openIncidentCount,
  };
  const badgeTone: Record<string, string> = {
    maintenance: '',
    inventory: 'amber',
    incidents: '',
  };

  const handleNavigate = (module: string) => {
    setActiveModule(module);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden font-sans" style={{ background: 'var(--bg)' }}>
      {/* Sidebar (escritorio) */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 w-[230px] transition-colors duration-300"
        style={{ background: 'var(--sidebar-bg)', boxShadow: 'var(--sidebar-shadow)' }}
      >
        {/* Logo */}
        <div className="nav-logo">
          {BRANDING.icon ? (
            <img src={BRANDING.icon} alt="" className="nav-logo-icon object-cover" />
          ) : (
            <div className="nav-logo-icon">
              <Wrench size={18} style={{ color: 'var(--sidebar-logo-color)' }} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate">{BRANDING.appName}</h1>
            <p className="truncate">{BRANDING.appSubtitle}</p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-1">
          {navSections.map((section) => {
            const items = section.items.filter(item => !item.restricted);
            if (items.length === 0) return null;
            return (
              <div key={section.label}>
                <div className="nav-section">{section.label}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  const badge = badgeCounts[item.id] ?? 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`nav-item w-[calc(100%-16px)] text-left ${isActive ? 'active' : ''}`}
                    >
                      <Icon size={17} />
                      <span className="truncate">{item.label}</span>
                      {badge > 0 && (
                        <span className={`nav-badge ${badgeTone[item.id] ?? ''}`}>
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Pie: usuario + tema + logout */}
        <div className="nav-user">
          <div className="nav-user-card">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.08))',
                  border: '1px solid rgba(255,255,255,.2)',
                  color: 'var(--sidebar-logo-color)',
                }}
              >
                {currentUser.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
                  {currentUser.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--sidebar-text2)' }}>
                  {currentUser.role}
                </p>
              </div>
              <button
                onClick={logout}
                title="Cerrar Sesión"
                className="p-1.5 rounded-md transition-colors hover:bg-white/10"
                style={{ color: 'var(--sidebar-text2)' }}
              >
                <LogOut size={15} />
              </button>
            </div>
            <ThemeSelector />
          </div>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden transition-colors duration-300" style={{ background: 'var(--bg)' }}>
        {/* Topbar */}
        <header
          className="flex-shrink-0 h-[54px] flex items-center gap-3 px-4 lg:px-5 transition-colors duration-300"
          style={{
            background: 'var(--topbar-bg)',
            boxShadow: 'var(--topbar-shadow)',
            paddingTop: 'env(safe-area-inset-top)',
            height: 'calc(54px + env(safe-area-inset-top))',
          }}
        >
          {/* Logo compacto en móvil */}
          <div className="flex items-center gap-2 lg:hidden min-w-0">
            {BRANDING.icon && (
              <img src={BRANDING.icon} alt="" className="w-7 h-7 rounded-md object-cover" style={{ border: '1px solid rgba(255,255,255,.2)' }} />
            )}
            <span className="text-[13px] font-bold truncate" style={{ color: 'var(--topbar-text)' }}>
              {BRANDING.appName}
            </span>
          </div>

          {/* Badges de alerta */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {!isObserver && unassignedCount > 0 && (
              <button
                onClick={() => handleNavigate('maintenance')}
                className="nav-badge flat whitespace-nowrap"
                title="OTs sin asignar"
              >
                OTs sin asignar · {unassignedCount}
              </button>
            )}
            {canAccessInventory && lowStockCount > 0 && (
              <button
                onClick={() => handleNavigate('inventory')}
                className="nav-badge flat amber whitespace-nowrap"
                title="Repuestos con stock bajo"
              >
                Stock bajo · {lowStockCount}
              </button>
            )}
            {openIncidentCount > 0 && (
              <button
                onClick={() => handleNavigate('incidents')}
                className="nav-badge flat whitespace-nowrap"
                title="Incidencias abiertas"
              >
                Incidencias · {openIncidentCount}
              </button>
            )}
          </div>

          <div className="flex-1" />

          <Clock />

          {!isObserver && (
            <button
              onClick={() => {
                handleNavigate('maintenance');
                setCreationMode(true);
              }}
              className="btn btn-primary hidden sm:inline-flex"
            >
              <Plus size={14} />
              <span className="hidden md:inline">Nueva OT</span>
            </button>
          )}
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-[calc(1rem+env(safe-area-inset-top))] lg:p-6 lg:pt-6 lg:pb-6 scroll-smooth relative">
          <div className="w-full min-h-full animate-fade-in">
            {children}
            <div className="lg:hidden h-24 w-full" aria-hidden="true" />
          </div>
        </main>

        {/* Barra inferior móvil */}
        <div className="lg:hidden fixed bottom-6 left-2 right-2 rounded-2xl z-30 flex items-end gap-1 p-2 pb-3"
          style={{
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex-1 flex items-end justify-between gap-1">
            {!isObserver && (
              <button
                onClick={() => handleNavigate('dashboard')}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'dashboard' ? 'text-accent' : 'text-txt-3'}`}
              >
                <LayoutDashboard size={20} />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase">Inicio</span>
              </button>
            )}

            {!isObserver && (
              <button
                onClick={() => handleNavigate('maintenance')}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'maintenance' ? 'text-accent' : 'text-txt-3'}`}
              >
                <span className="relative">
                  <ClipboardList size={20} />
                  {unassignedCount > 0 && (
                    <span className="nav-badge flat absolute -top-1.5 -right-2 !min-w-[14px] !h-3.5 !px-0.5 !text-[8px]">{unassignedCount > 9 ? '9+' : unassignedCount}</span>
                  )}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase">Tareas</span>
              </button>
            )}

            <button
              onClick={() => handleNavigate('incidents')}
              className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'incidents' ? 'text-accent' : 'text-txt-3'}`}
            >
              <span className="relative">
                <AlertCircle size={20} />
                {openIncidentCount > 0 && (
                  <span className="nav-badge flat absolute -top-1.5 -right-2 !min-w-[14px] !h-3.5 !px-0.5 !text-[8px]">{openIncidentCount > 9 ? '9+' : openIncidentCount}</span>
                )}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase">Incid.</span>
            </button>

            {!isObserver && (
              <>
                <button
                  className="flex-shrink-0 flex flex-col items-center gap-1 p-3 -mt-8 text-white rounded-full transition-transform hover:scale-110 active:scale-95 z-40 mx-1"
                  style={{ background: 'var(--btn-primary-bg)', boxShadow: '0 4px 14px rgba(0,0,0,.3)' }}
                  onClick={() => {
                    handleNavigate('maintenance');
                    setCreationMode(true);
                  }}
                >
                  <Plus size={24} />
                </button>

                {canAccessInventory && (
                  <button
                    onClick={() => handleNavigate('inventory')}
                    className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'inventory' ? 'text-accent' : 'text-txt-3'}`}
                  >
                    <span className="relative">
                      <Box size={20} />
                      {lowStockCount > 0 && (
                        <span className="nav-badge flat amber absolute -top-1.5 -right-2 !min-w-[14px] !h-3.5 !px-0.5 !text-[8px]">{lowStockCount > 9 ? '9+' : lowStockCount}</span>
                      )}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase">Stock</span>
                  </button>
                )}

                <button
                  onClick={() => handleNavigate('equipment')}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'equipment' ? 'text-accent' : 'text-txt-3'}`}
                >
                  <Wrench size={20} />
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase">Equipos</span>
                </button>
              </>
            )}
          </div>

          {/* Menú de cuenta */}
          <div className="relative flex-shrink-0">
            <AnimatePresence>
              {isAccountMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full mb-4 right-0 w-52 rounded-2xl p-2 z-50 overflow-hidden"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
                >
                  <div className="px-4 py-3 mb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Usuario</p>
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{currentUser.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text2)' }}>{currentUser.role}</p>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Tema</span>
                    <ThemeSelector compact />
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setIsAccountMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium btn-danger"
                  >
                    <LogOut size={18} />
                    <span>Cerrar Sesión</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className={`flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${isAccountMenuOpen ? 'text-accent' : 'text-txt-3'}`}
            >
              <Users size={20} />
              <span className="text-[9px] sm:text-[10px] font-bold uppercase">Cuenta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
