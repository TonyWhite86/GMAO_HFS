import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { User, UserRole, Section } from '../types';
import { Search, Plus, UserPlus, Trash2, Edit2, Shield, Mail, Check, X, Building2, UserCircle, Briefcase, ToggleLeft, ToggleRight, Book, KeyRound } from 'lucide-react';
import { GenericSkeleton } from '../components/GenericSkeleton';
import { GenericTable } from '../components/GenericTable';
import { normalizeForSearch } from '../utils/searchUtils';
import { SkillsMatrix } from '../components/users/SkillsMatrix';
import { SkillsManagementModal } from '../components/users/SkillsManagementModal';
import { PermissionModal } from '../components/users/PermissionModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppStore } from '../store/useAppStore';

interface UsersProps { }

export const UsersModule: React.FC = () => {
    const {
        users,
        sections,
        currentUser,
        addUser: onAddUser,
        updateUser: onUpdateUser,
        deleteUser: onDeleteUser,
        addSection: onAddSection,
        deleteSection: onDeleteSection,
        updateSection: onEditSection
    } = useAppStore();

    if (!currentUser) return <GenericSkeleton />;

    const [activeTab, setActiveTab] = useState<'users' | 'sections' | 'skills'>('users');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSection, setSelectedSection] = useState<string>('all');

    // Modal States
    const [showUserModal, setShowUserModal] = useState(false);
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [showSkillsModal, setShowSkillsModal] = useState(false);
    const [skillsRefreshTrigger, setSkillsRefreshTrigger] = useState(0);
    const [permissionUser, setPermissionUser] = useState<User | null>(null);

    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
        confirmLabel?: string;
        variant?: 'danger' | 'default';
    } | null>(null);

    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editingSection, setEditingSection] = useState<Section | null>(null);

    const { copyPermissionsFromUser } = useAppStore();

    // Form States for User
    const [formData, setFormData] = useState<Partial<User>>({
        name: '',
        email: '',
        role: UserRole.TECHNICIAN,
        active: true,
        sections: []
    });
    const [copyFromUserId, setCopyFromUserId] = useState('');
    const [formPassword, setFormPassword] = useState('');

    // Form State for Section
    const [sectionName, setSectionName] = useState('');

    // Filtering
    const filteredUsers = users.filter(user => {
        const term = normalizeForSearch(searchTerm);
        const matchesSearch = normalizeForSearch(user.name).includes(term) ||
            normalizeForSearch(user.email).includes(term) ||
            normalizeForSearch(user.role).includes(term);

        const matchesSection = selectedSection === 'all' || user.sections.includes(selectedSection);

        return matchesSearch && matchesSection;
    });

    const filteredSections = sections.filter(section =>
        normalizeForSearch(section.name).includes(normalizeForSearch(searchTerm))
    );

    // --- Handlers ---
    const handleUserSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const isNowAdmin = (formData.role || UserRole.TECHNICIAN) === UserRole.ADMIN;
        if (editingUser) {
            await onUpdateUser({ ...editingUser, ...formData, sections: isNowAdmin ? [] : (formData.sections || []) } as User);
        } else {
            const newUser = {
                id: crypto.randomUUID(),
                name: formData.name || '',
                email: formData.email || '',
                role: formData.role || UserRole.TECHNICIAN,
                active: formData.active !== undefined ? formData.active : true,
                sections: isNowAdmin ? [] : (formData.sections || []),
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || '')}&background=random`
            };
            const created = await onAddUser(newUser, formPassword);
            if (copyFromUserId && created) {
                try {
                    await copyPermissionsFromUser(copyFromUserId, created.id);
                } catch (err) {
                    console.error('Error copying permissions:', err);
                }
            }
        }
        setShowUserModal(false);
        setEditingUser(null);
        setCopyFromUserId('');
        setFormPassword('');
        setFormData({ name: '', email: '', role: UserRole.TECHNICIAN, active: true, sections: [] });
    };

    const handleSectionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSection) {
                await onEditSection({ ...editingSection, name: sectionName });
            } else {
                if (sectionName && !sections.find(s => s.name === sectionName)) {
                    await onAddSection({ name: sectionName, isSpecial: false });
                } else if (sections.find(s => s.name === sectionName)) {
                    toast.error('Esta sección ya existe');
                }
            }
            setSectionName('');
            setShowSectionModal(false);
            setEditingSection(null);
        } catch (error) {
            console.error('Error saving section:', error);
        }
    };

    const openEditUser = (user: User) => {
        setEditingUser(user);
        setFormData(user);
        setShowUserModal(true);
    };

    const openEditSection = (section: Section) => {
        setEditingSection(section);
        setSectionName(section.name);
        setShowSectionModal(true);
    };

    // Helper for role badge colors
    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case UserRole.ADMIN: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
            case UserRole.SECTION_MANAGER: return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';
            case UserRole.TECHNICIAN: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
            default: return 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-600';
        }
    };

    // User Columns
    const userColumns = useMemo(() => [
        {
            header: "Usuario",
            sortKey: "name",
            render: (user: User) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border-2 border-white dark:border-slate-600 shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium text-slate-900 dark:text-white">{user.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                </div>
            )
        },
        {
            header: "Rol",
            sortKey: "role",
            render: (user: User) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 w-fit ${getRoleColor(user.role)}`}>
                    <Shield size={12} />
                    {user.role}
                </span>
            )
        },
        {
            header: "Secciones",
            render: (user: User) => {
                if (user.role === UserRole.ADMIN) {
                    return (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800 flex items-center gap-1 w-fit">
                            <Shield size={10} /> Acceso Global
                        </span>
                    );
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {user.sections.length > 0 ? user.sections.map(s => (
                            <span key={s} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                {s}
                            </span>
                        )) : <span className="text-xs text-slate-400 italic">Sin asignar</span>}
                    </div>
                );
            }
        },
        {
            header: "Estado",
            sortKey: "active",
            render: (user: User) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (user.id === currentUser.id) return toast.error("No puedes desactivar tu propio usuario.");
                        onUpdateUser({ ...user, active: !user.active });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${user.active
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
                        }`}
                >
                    {user.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {user.active ? 'Activo' : 'Inactivo'}
                </button>
            )
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (user: User) => (
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => setPermissionUser(user)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                        title="Permisos"
                    >
                        <KeyRound size={16} />
                    </button>
                    <button
                        onClick={() => openEditUser(user)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    >
                        <Edit2 size={16} />
                    </button>
                    {user.id !== currentUser.id && (
                        <button
                            onClick={() => setConfirmAction({
                                title: 'Eliminar usuario',
                                message: `¿Estás seguro de eliminar a ${user.name}?`,
                                onConfirm: () => onDeleteUser(user.id)
                            })}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )
        }
    ], [currentUser, onDeleteUser, onUpdateUser]);

    const renderUserCard = (user: User) => (
        <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border-2 border-white dark:border-slate-600 shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">{user.name}</h3>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Mail size={12} /> {user.email}
                        </div>
                    </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${user.active
                    ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                    : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                    }`}>
                    {user.active ? 'Activo' : 'Inactivo'}
                </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1 ${getRoleColor(user.role)}`}>
                    <Shield size={12} /> {user.role}
                </span>
                {user.role === UserRole.ADMIN ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium">
                        Acceso Global
                    </span>
                ) : (
                    user.sections.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            {s}
                        </span>
                    ))
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                    onClick={() => openEditUser(user)}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
                >
                    <Edit2 size={14} /> Editar
                </button>
                {user.id !== currentUser.id && (
                    <button
                        onClick={() => setConfirmAction({
                            title: 'Eliminar usuario',
                            message: `¿Estás seguro de eliminar a ${user.name}?`,
                            onConfirm: () => onDeleteUser(user.id)
                        })}
                        className="flex items-center justify-center gap-2 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
                    >
                        <Trash2 size={14} /> Eliminar
                    </button>
                )}
            </div>
        </div>
    );

    // Section Columns
    const sectionColumns = useMemo(() => [
        {
            header: "Nombre de Sección",
            sortKey: "name",
            render: (section: Section & { count: number }) => (
                <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 size={18} className="text-slate-400" />
                    {section.name}
                </div>
            )
        },
        {
            header: "Usuarios Asignados",
            sortKey: "count",
            render: (item: Section & { count: number }) => (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <UserCircle size={16} />
                    <span>{item.count} usuarios</span>
                </div>
            )
        },
        {
            header: "Asignación Especial",
            render: (item: Section & { count: number }) => {
                const isSpecial = item.isSpecial;
                return (
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            await onEditSection({ ...item, isSpecial: !isSpecial });
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all border ${isSpecial
                            ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        title="Permitir que esta sección reciba asignaciones de otras secciones"
                    >
                        {isSpecial ? <Check size={12} /> : <X size={12} />}
                        {isSpecial ? 'Especial' : 'Estándar'}
                    </button>
                );
            }
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (item: Section & { count: number }) => (
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => openEditSection(item)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => setConfirmAction({
                            title: 'Eliminar sección',
                            message: `¿Estás seguro de eliminar la sección "${item.name}"?`,
                            onConfirm: () => onDeleteSection(item.id)
                        })}
                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ], [onDeleteSection, onEditSection]);

    const renderSectionCard = (item: Section & { count: number }) => (
        <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 size={18} className="text-blue-500" />
                    {item.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <UserCircle size={14} /> {item.count} usuarios activos
                </p>
                {item.isSpecial && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">Especial</span>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={() => openEditSection(item)} className="p-2 text-slate-400 hover:text-blue-500 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <Edit2 size={16} />
                </button>
                <button
                    onClick={() => setConfirmAction({
                        title: 'Eliminar sección',
                        message: `¿Estás seguro de eliminar la sección "${item.name}"?`,
                        onConfirm: () => onDeleteSection(item.id)
                    })}
                    className="p-2 text-slate-400 hover:text-red-500 bg-slate-100 dark:bg-slate-700/50 rounded-lg"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );

    // Prepare Data for Sections Table
    const sectionsData = useMemo(() => {
        return filteredSections.map(sec => ({
            ...sec,
            count: users.filter(u => u.sections.includes(sec.name)).length
        }));
    }, [filteredSections, users]);


    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title="Gestión de Usuarios"
                actions={
                    <>
                        {activeTab === 'users' && (
                            <button
                                onClick={() => setShowUserModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg transition-colors bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                            >
                                <UserPlus size={18} />
                                <span>Nuevo Usuario</span>
                            </button>
                        )}

                        {activeTab === 'sections' && (
                            <button
                                onClick={() => setShowSectionModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg transition-colors bg-purple-600 hover:bg-purple-700 shadow-purple-600/20"
                            >
                                <Plus size={18} />
                                <span>Nueva Sección</span>
                            </button>
                        )}

                        {activeTab === 'skills' && (
                            <button
                                onClick={() => setShowSkillsModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg transition-colors bg-orange-600 hover:bg-orange-700 shadow-orange-600/20"
                            >
                                <Book size={18} />
                                <span>Gestionar Habilidades</span>
                            </button>
                        )}
                    </>
                }
            />

            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg inline-flex border border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'users'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('sections')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'sections'
                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Secciones
                </button>
                <button
                    onClick={() => setActiveTab('skills')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'skills'
                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    Matriz de Polivalencia
                </button>
            </div>

            {/* Search Bar & Filters */}
            {activeTab !== 'skills' && (
                <div className="bg-white dark:bg-slate-700 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder={activeTab === 'users' ? "Buscar usuario por nombre, email..." : "Buscar sección..."}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Section Filter (Only visible in Users tab) */}
                    {activeTab === 'users' && (
                        <div className="w-full md:w-64">
                            <select
                                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                value={selectedSection}
                                onChange={(e) => setSelectedSection(e.target.value)}
                            >
                                <option value="all">Todas las secciones</option>
                                {sections.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Content */}
            <div>
                {activeTab === 'users' && (
                    <GenericTable
                        data={filteredUsers}
                        columns={userColumns}
                        renderCard={renderUserCard}
                        itemsPerPage={25}
                        emptyMessage="No se encontraron usuarios."
                    />
                )}
                {activeTab === 'sections' && (
                    <GenericTable
                        data={sectionsData}
                        columns={sectionColumns}
                        renderCard={renderSectionCard}
                        itemsPerPage={25}
                        emptyMessage="No se encontraron secciones."
                    />
                )}
                {activeTab === 'skills' && (
                    <SkillsMatrix users={users} refreshTrigger={skillsRefreshTrigger} />
                )}
            </div>

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-700 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-100 dark:bg-slate-800">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h2>
                            <button 
                                onClick={() => { setShowUserModal(false); setEditingUser(null); }} 
                                    className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                                >
                                    <X size={20} className="sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña inicial</label>
                                    <input
                                        required
                                        type="text"
                                        autoComplete="new-password"
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formPassword}
                                        onChange={e => setFormPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                        Comunícasela al usuario. Podrá cambiarla en el futuro.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    >
                                        {Object.values(UserRole).map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                                    <div className="flex items-center h-[42px] px-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.active}
                                                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {formData.active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Asignar Secciones</label>
                                {formData.role === UserRole.ADMIN ? (
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                        <Shield size={16} />
                                        Los administradores tienen acceso automático a todas las secciones.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-lg custom-scrollbar">
                                        {sections.map(sec => (
                                            <label key={sec.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.sections?.includes(sec.name)}
                                                    onChange={e => {
                                                        const current = formData.sections || [];
                                                        if (e.target.checked) setFormData({ ...formData, sections: [...current, sec.name] });
                                                        else setFormData({ ...formData, sections: current.filter(s => s !== sec.name) });
                                                    }}
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                {sec.name}
                                            </label>
                                        ))}
                                        {sections.length === 0 && <span className="text-xs text-slate-400 p-1">No hay secciones disponibles</span>}
                                    </div>
                                )}
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Copiar permisos de (opcional)
                                    </label>
                                    <select
                                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        value={copyFromUserId}
                                        onChange={e => setCopyFromUserId(e.target.value)}
                                    >
                                        <option value="">No copiar permisos</option>
                                        {users
                                            .filter(u => u.id !== currentUser.id && u.active)
                                            .map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700 mt-2">
                                <button type="button" onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Section Modal */}
            {showSectionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-700 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-100 dark:bg-slate-800">
                            <h3 className="font-bold text-slate-800 dark:text-white">{editingSection ? 'Editar Sección' : 'Nueva Sección'}</h3>
                            <button 
                                onClick={() => setShowSectionModal(false)}
                                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                            >
                                <X size={20} className="sm:size-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSectionSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nombre</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Nombre de la sección..."
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={sectionName}
                                    onChange={e => setSectionName(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => { setShowSectionModal(false); setEditingSection(null); }} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={!sectionName.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-lg shadow-purple-600/20">
                                    {editingSection ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <SkillsManagementModal
                isOpen={showSkillsModal}
                onClose={() => setShowSkillsModal(false)}
                onSkillsChange={() => setSkillsRefreshTrigger(prev => prev + 1)}
            />

            {permissionUser && (
                <PermissionModal
                    user={permissionUser}
                    onClose={() => setPermissionUser(null)}
                />
            )}

            {confirmAction && (
                <ConfirmDialog
                    title={confirmAction.title}
                    message={confirmAction.message}
                    confirmLabel={confirmAction.confirmLabel}
                    variant={confirmAction.variant}
                    onConfirm={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </div>
    );
};