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
                icon={<div className="p-2 bg-accent-dim rounded-lg text-accent"><Shield size={20} /></div>}
            >
                Permisos: {user.name}
            </Modal.Header>

            <Modal.Body>
                {isAdmin ? (
                    <div className="p-4 bg-accent-dim border border-accent-border rounded-xl text-sm text-accent flex items-center gap-3">
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
                                    <div key={mod.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-line">
                                        <div>
                                            <span className="font-medium text-txt text-sm">{mod.label}</span>
                                            <p className="text-xs text-txt-2 mt-0.5">
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
                                                                ? 'bg-ko-dim text-ko border-ko-border  text-ko '
                                                                : pl.id === 'consulta'
                                                                    ? 'bg-accent-dim text-accent border-accent-border  text-accent '
                                                                    : pl.id === 'parcial'
                                                                        ? 'bg-warn-dim text-warn border-warn-border  text-warn '
                                                                        : 'bg-ok-dim text-ok border-ok-border'
                                                            : 'bg-surface text-txt-3 border-line hover:border-line-2'
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

                        <div className="border-t border-line pt-4">
                            <label className="block text-sm font-medium text-txt-2 mb-2">
                                Copiar permisos de otro usuario
                            </label>
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 p-2 border border-line rounded-lg bg-surface text-txt focus:ring-2 focus:ring-accent outline-none text-sm"
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
                                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-2 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-accent/20"
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
                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-2 transition-colors shadow-lg shadow-accent/20 flex items-center gap-2"
                >
                    <Check size={16} />
                    Cerrar
                </button>
            </Modal.Footer>
        </Modal>
    );
};
