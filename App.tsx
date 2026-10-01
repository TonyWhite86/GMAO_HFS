import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { LoginPage } from './components/LoginPage';
import { LoadingSpinner } from './components/LoadingSpinner';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { MaintenanceSkeleton } from './components/MaintenanceSkeleton';
import { GenericSkeleton } from './components/GenericSkeleton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { WOStatus, WOPriority } from './types';
import { useAppStore } from './store/useAppStore';
import { mapProfile } from './utils/mappers';

// Lazy loaded modules
const Maintenance = lazy(() => import('./modules/Maintenance').then(module => ({ default: module.Maintenance })));
const Scheduler = lazy(() => import('./modules/Scheduler').then(module => ({ default: module.Scheduler })));
const EquipmentModule = lazy(() => import('./modules/Equipment').then(module => ({ default: module.EquipmentModule })));
const InventoryModule = lazy(() => import('./modules/Inventory').then(module => ({ default: module.InventoryModule })));
const Dashboard = lazy(() => import('./modules/Dashboard').then(module => ({ default: module.Dashboard })));
const ReportsModule = lazy(() => import('./modules/Reports').then(module => ({ default: module.ReportsModule })));
const UsersModule = lazy(() => import('./modules/Users').then(module => ({ default: module.UsersModule })));
const IncidentsModule = lazy(() => import('./modules/Incidents').then(module => ({ default: module.IncidentsModule })));

const App: React.FC = () => {
  // Global Store State
  const {
    currentUser,
    isDarkMode,
    activeModule,
    setActiveModule,
    fetchInitialData,
    initializeSubscription,
    login,
    isLoading,
    error
  } = useAppStore();

  const { isOffline } = useNetworkStatus();

  // Helper for internal navigation
  const setCurrentModule = setActiveModule;

  // State to control Maintenance modal opening from other modules (keep these local as they are UI transition state)
  const [maintenanceInitialMode, setMaintenanceInitialMode] = useState<'create' | null>(null);
  const [maintenanceInitialFilters, setMaintenanceInitialFilters] = useState<{ status?: WOStatus[], unassigned?: boolean, priority?: WOPriority[], section?: string[] } | null>(null);
  const [inventoryInitialMode, setInventoryInitialMode] = useState<'withdrawal' | null>(null);
  const [inventoryInitialTab, setInventoryInitialTab] = useState<'requests' | null>(null);

  const handleCreateWorkOrderRequest = () => {
    setMaintenanceInitialMode('create');
    setCurrentModule('maintenance');
  };

  const handleNavigateWithFilter = (module: string, filters: { status?: WOStatus[], unassigned?: boolean, priority?: WOPriority[], section?: string[] }) => {
    if (module === 'maintenance') {
      setMaintenanceInitialFilters(filters);
      setCurrentModule('maintenance');
    } else {
      setCurrentModule(module);
    }
  };

  const handleRequestWithdrawal = () => {
    setInventoryInitialMode('withdrawal');
    setCurrentModule('inventory');
  };

  const handleRequestPurchase = () => {
    setInventoryInitialTab('requests');
    setCurrentModule('inventory');
  };

  // Sync dark class with isDarkMode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Listen for system color scheme changes (with cleanup, unlike previous implementation in the store)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      useAppStore.setState({ isDarkMode: e.matches });
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Restore Supabase Auth session and load user data
  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;

    const loadUserFromSession = async (userId: string) => {
      const { supabase } = await import('./lib/supabase');
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (cancelled) return;

      if (!profile || !profile.active) {
        await supabase.auth.signOut();
        return;
      }

      login(mapProfile(profile));
      fetchInitialData();
      initializeSubscription();
    };

    import('./lib/supabase').then(({ supabase }) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (event === 'INITIAL_SESSION' && session?.user) {
          setTimeout(() => loadUserFromSession(session.user.id), 0);
        } else if (event === 'SIGNED_OUT') {
          useAppStore.setState({ currentUser: null });
        }
      });
      subscription = data.subscription;
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [login, fetchInitialData, initializeSubscription]);

  // Auto-retry when network comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (error || isLoading) {
        fetchInitialData();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [error, isLoading, fetchInitialData]);

  // Enforce module restrictions for Observers
  useEffect(() => {
    if (currentUser && (currentUser.role === 'Observador N1' || currentUser.role === 'Observador N2')) {
      if (activeModule !== 'incidents') {
        setActiveModule('incidents');
      }
    }
  }, [currentUser?.role, activeModule, setActiveModule]);

  // Render only the content of the module, without the motion wrapper
  const renderModuleContent = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={setCurrentModule}
            onNavigateWithFilter={handleNavigateWithFilter}
            onCreateWorkOrder={handleCreateWorkOrderRequest}
            onRequestWithdrawal={handleRequestWithdrawal}
            onRequestPurchase={handleRequestPurchase}
          />
        );
      case 'maintenance':
        return (
          <Maintenance
            initialMode={maintenanceInitialMode}
            onModeHandled={() => setMaintenanceInitialMode(null)}
            initialFilters={maintenanceInitialFilters}
          />
        );
      case 'scheduler':
        return <Scheduler />;
      case 'equipment':
        return <EquipmentModule />;
      case 'inventory':
        return (
          <InventoryModule
            initialMode={inventoryInitialMode}
            onModeHandled={() => {
              setInventoryInitialMode(null);
              setInventoryInitialTab(null);
            }}
            initialTab={inventoryInitialTab}
          />
        );
      case 'users':
        return <UsersModule />;
      case 'reports':
        return <ReportsModule />;
      case 'incidents':
        return <IncidentsModule />;
      default:
        return <div className="dark:text-white">Módulo no encontrado</div>;
    }
  };

  const renderSkeleton = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardSkeleton />;
      case 'maintenance':
        return <MaintenanceSkeleton />;
      default:
        return <GenericSkeleton />;
    }
  };

  return (
    <>
      {isOffline && <OfflineBanner onRetry={() => fetchInitialData()} />}
      <Toaster position="top-right" richColors expand gap={14} visibleToasts={5} />
      {!currentUser ? (
        <LoginPage />
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-800">
          <LoadingSpinner />
          {error && (
            <p className="mt-4 text-sm text-red-500 dark:text-red-400 px-4 text-center">
              {error} —{' '}
              <button onClick={() => fetchInitialData()} className="underline hover:no-underline">
                Reintentar
              </button>
            </p>
          )}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-800 p-8">
          <div className="bg-white dark:bg-slate-700 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Error de carga</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{error}</p>
            <button
              onClick={() => fetchInitialData()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <Layout>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full"
            >
              <React.Suspense fallback={renderSkeleton()}>
                <ErrorBoundary>
                  {renderModuleContent()}
                </ErrorBoundary>
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </Layout>
      )}
    </>
  );
};

export default App;