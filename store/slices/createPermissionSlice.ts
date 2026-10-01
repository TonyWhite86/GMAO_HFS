import { StateCreator } from 'zustand';
import { UserPermission, PermissionLevel } from '../../types';
import { permissionService } from '../../services/permissionService';
import { toast } from 'sonner';

export interface PermissionSlice {
    userPermissions: UserPermission[];
    setUserPermissions: (perms: UserPermission[]) => void;
    setUserPermission: (userId: string, module: string, level: PermissionLevel) => Promise<void>;
    copyPermissionsFromUser: (fromUserId: string, toUserId: string) => Promise<UserPermission[]>;
    getPermissionLevel: (userId: string, module: string) => PermissionLevel;
}

export const createPermissionSlice: StateCreator<PermissionSlice, [], [], PermissionSlice> = (set, get) => ({
    userPermissions: [],

    setUserPermissions: (perms) => set({ userPermissions: perms }),

    setUserPermission: async (userId, module, level) => {
        try {
            const saved = await permissionService.setPermission(userId, module, level);
            set((state) => {
                const exists = state.userPermissions.find(
                    p => p.userId === userId && p.module === module
                );
                if (exists) {
                    return {
                        userPermissions: state.userPermissions.map(
                            p => p.id === saved.id ? saved : p
                        )
                    };
                }
                return { userPermissions: [...state.userPermissions, saved] };
            });
            toast.success('Permiso actualizado');
        } catch (error) {
            toast.error('Error al actualizar permiso');
            throw error;
        }
    },

    copyPermissionsFromUser: async (fromUserId, toUserId) => {
        try {
            const copied = await permissionService.copyFromUser(fromUserId, toUserId);
            set((state) => ({
                userPermissions: [
                    ...state.userPermissions.filter(p => p.userId !== toUserId),
                    ...copied
                ]
            }));
            toast.success('Permisos copiados correctamente');
            return copied;
        } catch (error) {
            toast.error('Error al copiar permisos');
            throw error;
        }
    },

    getPermissionLevel: (userId, module) => {
        const state = get();
        const perm = state.userPermissions.find(
            p => p.userId === userId && p.module === module
        );
        return perm?.level ?? 'sin_acceso';
    }
});
