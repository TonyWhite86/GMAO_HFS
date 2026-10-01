import React, { useState, useMemo } from 'react';
import { User, PermissionLevel } from '../../types';
import { PERMISSION_MODULES, PERMISSION_LEVELS } from '../../constants';
import { Shield, Copy, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from '../ui/Modal';

interface PermissionModalProps {
    user: User;
    onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({ user, onClose }) => {
    const { userPermissions, setUserPermission, copyPermissionsFromUser, users } = useAppStore();
    const [copyUserId, setCopyUserId] = useState<string>('');
    const [savingModule, setSavingModule] = useState<string | null>(null);

    const userPerms = useMemo(() =>
        userPermissions.filter(p => p.userId === user.id),
        [userPermissions, user.id]
    );

    const getLevel = (module: string): PermissionLevel => {
        const perm = userPerms.find(p => p.module === module);
        return perm?.level ?? 'sin_acceso';
    };

    const handleLevelChange = async (module: string, level: PermissionLevel) => {
        setSavingModule(module);
        try {
            await setUserPermission(user.id, module, level);
        } finally {
            setSavingModule(null);
        }
    };

    const handleCopy = async () => {
        if (!copyUserId) return;
        await copyPermissionsFromUser(copyUserId, user.id);
        setCopyUserId('');
    };

    const isAdmin = user.role === 'Admin';

    return (
        <Modal onClose={onClose} size="md">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Shield size={20} /></div>}
            >
                Permisos: {user.name}
            </Modal.Header>

            <Modal.Body>
                {isAdmin ? (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-sm text-blue-700 dark:text-blue-300 flex items-center gap-3">
                        <Shield size={20} />
                        Los administradores tienen acceso total a todos los módulos.
                    </div>
                ) : (
                    <>
                        <div className="space-y-3">
                            {PERMISSION_MODULES.map(mod => {
                                const currentLevel = getLevel(mod.id);
                                const isSaving = savingModule === mod.id;
                                return (
                                    <div key={mod.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600">
                                        <div>
                                            <span className="font-medium text-slate-800 dark:text-white text-sm">{mod.label}</span>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                {PERMISSION_LEVELS.find(l => l.id === currentLevel)?.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {PERMISSION_LEVELS.map(pl => {
                                                const isActive = currentLevel === pl.id;
                                                return (
                                                    <button
                                                        key={pl.id}
                                                        disabled={isSaving}
                                                        onClick={() => handleLevelChange(mod.id, pl.id)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${isActive
                                                            ? pl.id === 'sin_acceso'
                                                                ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                                                                : pl.id === 'consulta'
                                                                    ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                                                    : pl.id === 'parcial'
                                                                        ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                                                        : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                                            : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300'
                                                            } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                                                    >
                                                        {pl.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Copiar permisos de otro usuario
                            </label>
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    value={copyUserId}
                                    onChange={e => setCopyUserId(e.target.value)}
                                >
                                    <option value="">Seleccionar usuario...</option>
                                    {users
                                        .filter(u => u.id !== user.id && u.active)
                                        .map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                </select>
                                <button
                                    disabled={!copyUserId}
                                    onClick={handleCopy}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-blue-600/20"
                                >
                                    <Copy size={16} />
                                    Copiar
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                    <Check size={16} />
                    Cerrar
                </button>
            </Modal.Footer>
        </Modal>
    );
};
