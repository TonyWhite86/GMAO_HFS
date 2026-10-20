import React, { useState } from 'react';
import { User } from '../types';
import { BRANDING } from '../branding';
import { Lock, User as UserIcon, AlertCircle, Eye, EyeOff, Wrench } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const LoginPage: React.FC = () => {
    const { login, fetchInitialData, initializeSubscription } = useAppStore();
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
            const { supabase } = await import('../lib/supabase');
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError || !authData.user) {
                setError('Email o contraseña incorrectos');
                setIsLoading(false);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (!profile) {
                await supabase.auth.signOut();
                setError('No se encontró el perfil de usuario. Contacta con el administrador.');
                setIsLoading(false);
                return;
            }

            const user: User = {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role,
                sections: Array.isArray(profile.sections) ? profile.sections : [],
                active: profile.active,
                avatar: profile.avatar
            };

            if (!user.active) {
                await supabase.auth.signOut();
                setError('Esta cuenta ha sido desactivada. Contacta con el administrador.');
                setIsLoading(false);
                return;
            }

            login(user);
            fetchInitialData();
            initializeSubscription();
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Error técnico al iniciar sesión. Compruebe su conexión.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 transition-colors duration-300 relative overflow-hidden"
            style={{ background: 'var(--bg)' }}>
            {/* Background Patterns */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[30%] -right-[10%] w-[70%] h-[70%] rounded-full blur-3xl" style={{ background: 'var(--accentdim)' }}></div>
                <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full blur-3xl" style={{ background: 'var(--accentdim)' }}></div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
                <div className="flex justify-center mb-6">
                    {BRANDING.icon ? (
                        <div className="nav-logo-icon !w-[72px] !h-[72px] !rounded-[18px]">
                            <img src={BRANDING.icon} alt="" className="w-full h-full object-cover rounded-[16px]" />
                        </div>
                    ) : BRANDING.logo ? (
                        <>
                            <img src={BRANDING.logo} alt="Logo" className="logo-light h-24 w-auto object-contain drop-shadow-lg" />
                            {BRANDING.logoDark && (
                                <img src={BRANDING.logoDark} alt="Logo" className="logo-dark h-24 w-auto object-contain drop-shadow-lg" />
                            )}
                        </>
                    ) : (
                        <div className="nav-logo-icon !w-[72px] !h-[72px] !rounded-[18px]">
                            <Wrench size={32} style={{ color: 'var(--sidebar-logo-color)' }} />
                        </div>
                    )}
                </div>
                <h2 className="mt-2 text-center text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                    {BRANDING.loginTitle}
                </h2>
                <p className="mt-2 text-center text-sm" style={{ color: 'var(--text2)' }}>
                    {BRANDING.loginSubtitle}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
                <div className="modal !w-full !max-w-md !animate-none">
                    <div className="modal-body">
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div className="fld">
                                <label htmlFor="email">Correo Electrónico</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <UserIcon className="h-4 w-4" style={{ color: 'var(--text3)' }} aria-hidden="true" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="!pl-9"
                                        placeholder="usuario@healthy-foodsolutions.com"
                                    />
                                </div>
                            </div>

                            <div className="fld">
                                <label htmlFor="password">Contraseña</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4" style={{ color: 'var(--text3)' }} aria-hidden="true" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="!pl-9 !pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors"
                                        style={{ color: 'var(--text3)' }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-[10px] p-3.5 border animate-fade-in flex items-start gap-2.5"
                                    style={{ background: 'var(--reddim)', borderColor: 'var(--redborder)' }}>
                                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--red)' }} aria-hidden="true" />
                                    <h3 className="text-sm font-medium" style={{ color: 'var(--red)' }}>{error}</h3>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn btn-primary btn-full !py-3 !text-[13px] !font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : "Entrar →"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
