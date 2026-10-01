import { StateCreator } from 'zustand';
import { User } from '../../types';
import { userService } from '../../services/userService';
import { toast } from 'sonner';

export interface AuthSlice {
    currentUser: User | null;
    login: (user: User) => void;
    logout: () => void;
    users: User[];
    setUsers: (users: User[]) => void;
    addUser: (user: User) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
    currentUser: null,
    users: [],
    login: (user) => set({ currentUser: user }),
    logout: () => set({ currentUser: null }),
    setUsers: (users) => set({ users }),
    addUser: async (user) => {
        try {
            const created = await userService.create(user);
            toast.success('Usuario creado con éxito');
            set((state) => {
                if (state.users.find(u => u.id === created.id)) return state;
                return { users: [...state.users, created] };
            });
        } catch (error) {
            toast.error('Error al crear usuario');
            throw error;
        }
    },
    updateUser: async (user) => {
        try {
            await userService.update(user);
            toast.success('Usuario actualizado correctamente');
            set((state) => ({
                users: state.users.map(u => u.id === user.id ? user : u)
            }));
        } catch (error) {
            toast.error('Error al actualizar usuario');
            throw error;
        }
    },
    deleteUser: async (id) => {
        try {
            await userService.delete(id);
            toast.success('Usuario eliminado');
            set((state) => ({
                users: state.users.filter(u => u.id !== id)
            }));
        } catch (error) {
            toast.error('Error al eliminar usuario');
            throw error;
        }
    }
});
