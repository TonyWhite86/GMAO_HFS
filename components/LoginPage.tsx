import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { BRANDING } from '../branding';
import { Lock, User as UserIcon, AlertCircle, Eye, EyeOff, Wrench } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { toast } from 'sonner';
import { userIsInAlmacen } from '../utils/warehouseUtils';

export const LoginPage: React.FC = () => {
    const { login, users, isLoading: isStoreLoading, fetchInitialData } = useAppStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // First check local state
            let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

            // Fallback: If not in local state, it might be a newly created user not yet synced
            if (!user) {
                const { supabase } = await import('../lib/supabase');
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('email', email)
                    .single();

                if (profile) {
                    user = {
                        id: profile.id,
                        name: profile.name,
                        email: profile.email,
                        role: profile.role,
                        sections: Array.isArray(profile.sections) ? profile.sections : [],
                        active: profile.active,
                        avatar: profile.avatar
                    };
                }
            }

            if (user) {
                if (user.active) {
                    login(user);
                } else {
                    setError('Esta cuenta ha sido desactivada. Contacta con el administrador.');
                    setIsLoading(false);
                }
            } else {
                setError('Email o contraseña incorrectos (o usuario no sincronizado)');
                setIsLoading(false);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Error técnico al iniciar sesión. Compruebe su conexión.');
            setIsLoading(false);
        }
    };

    const handleDemoLogin = (type: 'admin' | 'manager' | 'technician' | 'warehouse_manager' | 'warehouse_technician' | 'observer_l1' | 'observer_l2') => {
        let user;
        const isWarehouse = (u: User) => userIsInAlmacen(u.sections);

        switch (type) {
            case 'admin':
                user = users.find(u => u.role === UserRole.ADMIN);
                break;
            case 'manager':
                user = users.find(u => u.role === UserRole.SECTION_MANAGER && !isWarehouse(u));
                break;
            case 'technician':
                user = users.find(u => u.role === UserRole.TECHNICIAN && !isWarehouse(u));
                break;
            case 'warehouse_manager':
                user = users.find(u => u.role === UserRole.SECTION_MANAGER && isWarehouse(u));
                break;
            case 'warehouse_technician':
                user = users.find(u => u.role === UserRole.TECHNICIAN && isWarehouse(u));
                break;
            case 'observer_l1':
                user = users.find(u => u.role === UserRole.OBSERVER_L1);
                break;
            case 'observer_l2':
                user = users.find(u => u.role === UserRole.OBSERVER_L2);
                break;
        }

        if (user) {
            login(user);
        } else {
            if (isStoreLoading) {
                toast.loading('Sincronizando usuarios para la demo...', { duration: 2000 });
            } else {
                toast.error('No se han podido cargar los usuarios para la demo. Reintentando...');
                fetchInitialData();
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-800 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-hidden">
            {/* Background Patterns */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full bg-blue-500/5 blur-3xl"></div>
                <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-500/5 blur-3xl"></div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
                <div className="flex justify-center mb-6">
                    {BRANDING.logo ? (
                        <>
                            <img src={BRANDING.logo} alt="Logo" className="h-16 w-auto object-contain drop-shadow-lg dark:hidden" />
                            {BRANDING.logoDark && (
                                <img src={BRANDING.logoDark} alt="Logo" className="h-16 w-auto object-contain drop-shadow-lg hidden dark:block" />
                            )}
                        </>
                    ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 transform rotate-3">
                            <Wrench size={32} />
                        </div>
                    )}
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {BRANDING.loginTitle}
                </h2>
                <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                    {BRANDING.loginSubtitle}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
                <div className="bg-white dark:bg-slate-700 py-8 px-4 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 sm:rounded-2xl sm:px-10 border border-slate-100 dark:border-slate-700/50 backdrop-blur-sm">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Correo Electrónico
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full pl-10 px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700/50 placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="usuario@healthy-foodsolutions.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Contraseña
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full pl-10 pr-10 px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700/50 placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm transition-all"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-900/30 animate-fade-in">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-300">{error}</h3>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : "Iniciar Sesión"}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                    Accesos Directos (Demo)
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                                { id: 'admin', label: 'Admin', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200' },
                                { id: 'manager', label: 'Jefe Manto.', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200' },
                                { id: 'technician', label: 'Técnico Manto.', color: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' },
                                { id: 'warehouse_manager', label: 'Jefe Almacén', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200' },
                                { id: 'warehouse_technician', label: 'Téc. Almacén', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' },
                                { id: 'observer_l1', label: 'Observador N1', color: 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200' },
                                { id: 'observer_l2', label: 'Observador N2', color: 'bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200' }
                            ].map((role) => (
                                <button
                                    key={role.id}
                                    onClick={() => handleDemoLogin(role.id as any)}
                                    className={`flex justify-center items-center px-3 py-2 border rounded-xl shadow-sm text-xs font-bold ${role.color} transition-colors backdrop-blur-sm bg-opacity-80 whitespace-nowrap`}
                                >
                                    {role.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
