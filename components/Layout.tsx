import React, { useState } from 'react';
import { BRANDING } from '../branding';
import { Menu, X, ClipboardList, Calendar, Box, Users, Wrench, LogOut, Sun, Moon, LayoutDashboard, ChevronLeft, ChevronRight, BarChart3, Plus, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { UserRole, WOStatus, IncidentStatus } from '../types';
import { useRestrictedItems } from '../hooks/useFilteredData';
import { useMemo } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const {
    currentUser,
    activeModule,
    setActiveModule,
    isDarkMode,
    toggleTheme,
    logout,
    setCreationMode
  } = useAppStore();

  const userPermissions = useAppStore(s => s.userPermissions);
  const workOrders = useAppStore(s => s.workOrders);
  const inventory = useAppStore(s => s.inventory);
  const incidents = useAppStore(s => s.incidents);

  const canAccessInventory = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) return true;
    const perm = userPermissions.find(p => p.userId === currentUser.id && p.module === 'inventory');
    return (perm?.level ?? 'sin_acceso') !== 'sin_acceso';
  }, [userPermissions, currentUser?.id, currentUser?.role]);

  // Notification badges (scoped to what the current user can actually see)
  const visibleWorkOrders = useRestrictedItems(
    workOrders,
    currentUser,
    (wo) => [wo.section, ...(wo.collaboratingSections || [])],
    (wo, user) => wo.assignedUserId === user.id || (wo.collaborators || []).includes(user.id)
  );
  const visibleIncidents = useRestrictedItems(incidents, currentUser);

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

  const badgeCounts: Record<string, number> = useMemo(() => ({
    maintenance: unassignedCount,
    inventory: lowStockCount,
    incidents: openIncidentCount,
  }), [unassignedCount, lowStockCount, openIncidentCount]);

  const badgeColors: Record<string, string> = {
    maintenance: 'bg-red-500',
    inventory: 'bg-amber-500',
    incidents: 'bg-red-500',
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  // Safety check if user is null (should only happen if redirected to login)
  if (!currentUser) return null;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      restricted: currentUser.role === 'Observador N1' || currentUser.role === 'Observador N2'
    },
    {
      id: 'maintenance',
      label: 'Mantenimiento',
      icon: ClipboardList,
      restricted: currentUser.role === 'Observador N1' || currentUser.role === 'Observador N2'
    },
    {
      id: 'scheduler',
      label: 'Programador',
      icon: Calendar,
      restricted: currentUser.role === 'Observador N1' || currentUser.role === 'Observador N2'
    },
    {
      id: 'equipment',
      label: 'Equipos',
      icon: Wrench,
      restricted: currentUser.role === 'Observador N1' || currentUser.role === 'Observador N2'
    },
    {
      id: 'inventory',
      label: 'Inventario',
      icon: Box,
      restricted: !canAccessInventory
    },
    {
      id: 'reports',
      label: 'Informes',
      icon: BarChart3,
      restricted: currentUser.role === 'Técnico' || currentUser.role === 'Observador N1' || currentUser.role === 'Observador N2'
    },
    { id: 'incidents', label: 'Incidencias', icon: AlertCircle },
    { id: 'users', label: 'Usuarios', icon: Users, restricted: currentUser.role !== 'Admin' },
  ];

  const handleNavigate = (module: string) => {
    setActiveModule(module);
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300 font-sans">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-30 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 transform transition-all duration-300 ease-in-out
        bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
        ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl w-72' : '-translate-x-full lg:translate-x-0'}
        lg:shadow-none ${isCollapsed ? 'w-20' : 'w-72 lg:w-64'} flex flex-col
      `}>
        {/* Toggle Button (Desktop Only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors z-50 active:scale-95"
          title={isCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo Section */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center p-4' : 'justify-between p-6'} mb-2`}>
          <div className="flex items-center space-x-3 group">
            {BRANDING.logo ? (
              <>
                <img src={BRANDING.logo} alt="Logo" className={`${isCollapsed ? 'h-5' : 'h-9'} w-auto max-w-full object-contain object-left dark:hidden`} />
                {BRANDING.logoDark && (
                  <img src={BRANDING.logoDark} alt="Logo" className={`${isCollapsed ? 'h-5' : 'h-9'} w-auto max-w-full object-contain object-left hidden dark:block`} />
                )}
              </>
            ) : (
              <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/30 transition-shadow">
                <Wrench size={20} />
              </div>
            )}
            {!isCollapsed && (
              <div className="animate-fade-in whitespace-nowrap overflow-hidden">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">{BRANDING.appName}</h1>
              </div>
            )}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-1">
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider animate-fade-in">
              Menú principal
            </div>
          )}
          {navItems.map((item) => {
            if (item.restricted) return null;
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const badge = badgeCounts[item.id] ?? 0;
            const badgeColor = badgeColors[item.id] ?? 'bg-red-500';
            return (
              <button
                key={item.id}
                onClick={() => {
                  handleNavigate(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center ${isCollapsed ? 'justify-center px-0 py-3' : 'space-x-3 px-3 py-2.5'} rounded-lg transition-all duration-200 group active:scale-[0.98]
                  ${isActive
                    ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="relative flex-shrink-0">
                  <Icon size={20} className={`transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                  {isCollapsed && badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full ${badgeColor} text-white text-[9px] font-bold flex items-center justify-center leading-none`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {!isCollapsed && <span className="whitespace-nowrap overflow-hidden animate-fade-in text-sm text-left">{item.label}</span>}
                {!isCollapsed && badge > 0 && (
                  <span className={`flex-shrink-0 ml-auto min-w-[20px] h-5 px-1.5 rounded-full ${badgeColor} text-white text-[11px] font-bold flex items-center justify-center leading-none`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer / User Profile */}
        <div className={`p-3 m-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 ${isCollapsed ? 'flex flex-col items-center gap-2 p-2 mx-2' : ''}`}>

          <div className={`flex items-center ${isCollapsed ? 'flex-col gap-2' : 'gap-3'}`}>
            <div className="w-9 h-9 flex-shrink-0 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 dark:from-slate-600 dark:to-slate-500 flex items-center justify-center text-sm font-bold text-white ring-2 ring-white dark:ring-slate-800">
              {currentUser.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{currentUser.role}</p>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-300 transition-colors active:scale-95 ${isCollapsed ? 'w-full flex justify-center' : ''}`}
              title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className={`${isCollapsed ? 'w-6 h-px my-1' : 'w-px h-6 mx-1'} bg-slate-200 dark:bg-slate-700`}></div>
            <button
              onClick={logout}
              className={`p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-300 transition-colors active:scale-95 ${isCollapsed ? 'w-full flex justify-center' : ''}`} title="Cerrar Sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-full overflow-hidden relative bg-slate-50 dark:bg-slate-950 transition-all duration-300 ease-in-out ${isCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-[calc(1rem+env(safe-area-inset-top))] lg:p-6 lg:pb-6 scroll-smooth relative">
          <div className="w-full min-h-full animate-fade-in">
            {children}
            {/* Spacer for mobile fixed bar */}
            <div className="lg:hidden h-24 w-full" aria-hidden="true" />
          </div>
        </div>

        <div className="lg:hidden fixed bottom-6 left-2 right-2 xs:left-4 xs:right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-2xl rounded-2xl z-30 flex items-end gap-1 p-2 pb-3">

          {/* Scrollable Navigation Items */}
          <div className="flex-1 flex items-end justify-between gap-1">
            {(currentUser.role !== 'Observador N1' && currentUser.role !== 'Observador N2') && (
              <button
                onClick={() => handleNavigate('dashboard')}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
              >
                <LayoutDashboard size={20} />
                <span className="text-[9px] sm:text-[10px] font-bold uppercase">Inicio</span>
              </button>
            )}

            {(currentUser.role !== 'Observador N1' && currentUser.role !== 'Observador N2') && (
              <button
                onClick={() => handleNavigate('maintenance')}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'maintenance' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
              >
                <span className="relative">
                  <ClipboardList size={20} />
                  {unassignedCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">{unassignedCount > 9 ? '9+' : unassignedCount}</span>
                  )}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase">Tareas</span>
              </button>
            )}

            <button
              onClick={() => handleNavigate('incidents')}
              className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'incidents' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
            >
              <span className="relative">
                <AlertCircle size={20} />
                {openIncidentCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">{openIncidentCount > 9 ? '9+' : openIncidentCount}</span>
                )}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase">Incid.</span>
            </button>

            {(currentUser.role !== 'Observador N1' && currentUser.role !== 'Observador N2') && (
              <>
                <button
                  className="flex-shrink-0 flex flex-col items-center gap-1 p-3 -mt-8 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/40 hover:scale-110 transition-transform active:scale-95 z-40 mx-1"
                  onClick={() => {
                    handleNavigate('maintenance');
                    setCreationMode(true);
                  }}
                >
                  <Plus size={24} />
                </button>

                {/* Mobile Inventory Button */}
                {canAccessInventory && (
                    <button
                      onClick={() => handleNavigate('inventory')}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'inventory' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
                    >
                      <span className="relative">
                        <Box size={20} />
                        {lowStockCount > 0 && (
                          <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">{lowStockCount > 9 ? '9+' : lowStockCount}</span>
                        )}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase">Stock</span>
                    </button>
                  )}

                <button
                  onClick={() => handleNavigate('equipment')}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${activeModule === 'equipment' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
                >
                  <Wrench size={20} />
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase">Equipos</span>
                </button>
              </>
            )}
          </div>

          {/* Account Button (Fixed outside scrollable area) */}
          <div className="relative flex-shrink-0">
            <AnimatePresence>
              {isAccountMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full mb-4 right-0 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Usuario</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors font-medium border-b border-slate-100 dark:border-slate-800"
                  >
                    {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-indigo-400" />}
                    <span>Modo {isDarkMode ? 'Claro' : 'Oscuro'}</span>
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      setIsAccountMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors font-medium "
                  >
                    <LogOut size={18} />
                    <span>Cerrar Sesión</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className={`flex flex-col items-center gap-1 p-1 sm:p-2 rounded-xl transition-all ${isAccountMenuOpen ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
            >
              <Users size={20} />
              <span className="text-[9px] sm:text-[10px] font-bold uppercase">Cuenta</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
