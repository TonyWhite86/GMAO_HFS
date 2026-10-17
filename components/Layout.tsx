import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Calendar, Box, Users, Wrench, LogOut, LayoutDashboard, BarChart3, Plus, AlertCircle, CalendarClock, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';
import { BRANDING } from '../branding';
import { useAppStore } from '../store/useAppStore';
import { WOStatus, IncidentStatus } from '../types';
import { useRestrictedItems } from '../hooks/useFilteredData';
import { canSeeIncident } from '../utils/incidentVisibility';
import { usePermissions } from '../hooks/usePermissions';

interface LayoutProps {
  children: React.ReactNode;
}

const Clock: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={`select-none ${collapsed ? 'flex justify-center' : 'flex items-center justify-between gap-2 px-1'}`}>
      {!collapsed && (
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--sidebar-text3)' }}>
          {now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
        </span>
      )}
      <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--sidebar-text)' }}>
        {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
};

const ThemeToggle: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  const isDarkMode = useAppStore(s => s.isDarkMode);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  return (
    <button
      onClick={toggleTheme}
      title={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
      aria-label={isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
      className={`flex items-center gap-2 p-1.5 rounded-md transition-colors hover:bg-white/10 ${collapsed ? 'justify-center w-full' : ''}`}
      style={{ color: 'var(--sidebar-text2)' }}
    >
      {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
      {!collapsed && <span className="text-[11px] font-medium">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
    </button>
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

  const [isCollapsed, setIsCollapsed] = useState(false);
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
        className={`hidden lg:flex flex-col flex-shrink-0 relative transition-all duration-300 ${isCollapsed ? 'w-[68px]' : 'w-[230px]'}`}
        style={{ background: 'var(--sidebar-bg)', boxShadow: 'var(--sidebar-shadow)' }}
      >
        {/* Botón colapsar/expandir */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
          className="absolute -right-3 top-9 z-50 rounded-full p-1 transition-colors active:scale-95"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo */}
        <div className="nav-logo" style={isCollapsed ? { justifyContent: 'center', padding: '16px 8px' } : undefined}>
          {BRANDING.icon ? (
            <img src={BRANDING.icon} alt="" className="nav-logo-icon object-cover" />
          ) : (
            <div className="nav-logo-icon">
              <Wrench size={18} style={{ color: 'var(--sidebar-logo-color)' }} />
            </div>
          )}
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate">{BRANDING.appName}</h1>
              <p className="truncate">{BRANDING.appSubtitle}</p>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto py-1">
          {navSections.map((section) => {
            const items = section.items.filter(item => !item.restricted);
            if (items.length === 0) return null;
            return (
              <div key={section.label}>
                {!isCollapsed && <div className="nav-section">{section.label}</div>}
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  const badge = badgeCounts[item.id] ?? 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`nav-item text-left ${isCollapsed ? 'w-[calc(100%-16px)] justify-center !px-0 !py-2.5 mx-auto' : 'w-[calc(100%-16px)]'} ${isActive ? 'active' : ''}`}
                    >
                      <span className="relative shrink-0">
                        <Icon size={17} />
                        {isCollapsed && badge > 0 && (
                          <span className={`nav-badge flat absolute -top-1 -right-1.5 !min-w-[13px] !h-[13px] !px-0.5 !text-[8px] !leading-none ${badgeTone[item.id] ?? ''}`}>
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </span>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                      {!isCollapsed && badge > 0 && (
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

        {/* Pie: reloj + usuario + tema + logout */}
        <div className="nav-user">
          <div className={isCollapsed ? 'px-1' : 'px-1 pb-2'}>
            <Clock collapsed={isCollapsed} />
          </div>
          <div className={`nav-user-card ${isCollapsed ? '!p-1.5 !border-0 !bg-transparent' : ''}`}>
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,.08))',
                    border: '1px solid rgba(255,255,255,.2)',
                    color: 'var(--sidebar-logo-color)',
                  }}
                  title={currentUser.name}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <ThemeToggle collapsed />
                <button
                  onClick={logout}
                  title="Cerrar Sesión"
                  className="p-1.5 rounded-md transition-colors hover:bg-white/10"
                  style={{ color: 'var(--sidebar-text2)' }}
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <>
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
                <ThemeToggle />
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Columna principal (sin topbar: el contenido ocupa todo el alto) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden transition-colors duration-300" style={{ background: 'var(--bg)' }}>
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
                        <span className="nav-badge amber absolute -top-1.5 -right-2 !min-w-[14px] !h-3.5 !px-0.5 !text-[8px]">{lowStockCount > 9 ? '9+' : lowStockCount}</span>
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
                  <div className="px-2 py-2">
                    <ThemeToggle />
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
