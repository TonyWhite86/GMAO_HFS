import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { User, UserRole, Section, IncidentCategory } from '../types';
import { Search, Plus, UserPlus, Trash2, Edit2, Shield, Mail, Check, X, Building2, UserCircle, Briefcase, ToggleLeft, ToggleRight, Book, KeyRound, Tag } from 'lucide-react';
import { GenericSkeleton } from '../components/GenericSkeleton';
import { GenericTable } from '../components/GenericTable';
import { normalizeForSearch } from '../utils/searchUtils';
import { SkillsMatrix } from '../components/users/SkillsMatrix';
import { SkillsManagementModal } from '../components/users/SkillsManagementModal';
import { CategoriesManagementModal } from '../components/users/CategoriesManagementModal';
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
        updateSection: onEditSection,
        deleteIncidentCategory
    } = useAppStore();

    if (!currentUser) return <GenericSkeleton />;

    const [activeTab, setActiveTab] = useState<'users' | 'sections' | 'skills' | 'categories'>('users');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSection, setSelectedSection] = useState<string>('all');

    // Modal States
    const [showUserModal, setShowUserModal] = useState(false);
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [showSkillsModal, setShowSkillsModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<IncidentCategory | null>(null);
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
            case UserRole.ADMIN: return 'bg-ko-dim text-ko border-ko-border';
            case UserRole.SECTION_MANAGER: return 'bg-spec-dim text-spec border-spec-border';
            case UserRole.TECHNICIAN: return 'bg-accent-dim text-accent border-accent-border';
            default: return 'bg-surface-3 text-txt-2 border-line';
        }
    };

    // User Columns
    const userColumns = useMemo(() => [
        {
            header: "Usuario",
            sortKey: "name",
            render: (user: User) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-txt-2 font-bold border-2 border-white shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium text-txt">{user.name}</div>
                        <div className="text-xs text-txt-2">{user.email}</div>
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
                        <span className="text-xs bg-accent-dim px-2 py-0.5 rounded text-accent font-medium border border-accent-border flex items-center gap-1 w-fit">
                            <Shield size={10} /> Acceso Global
                        </span>
                    );
                }
                return (
                    <div className="flex flex-wrap gap-1">
                        {user.sections.length > 0 ? user.sections.map(s => (
                            <span key={s} className="text-xs bg-surface-2 px-2 py-0.5 rounded text-txt-2">
                                {s}
                            </span>
                        )) : <span className="text-xs text-txt-3 italic">Sin asignar</span>}
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
                        ? 'bg-ok-dim text-ok   hover:bg-ok-dim '
                        : 'bg-ko-dim text-ko   hover:bg-ko-dim '
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
                        className="p-1.5 text-txt-2 hover:text-warn hover:bg-warn-dim rounded transition-colors"
                        title="Permisos"
                    >
                        <KeyRound size={16} />
                    </button>
                    <button
                        onClick={() => openEditUser(user)}
                        className="p-1.5 text-txt-2 hover:text-accent hover:bg-accent-dim rounded transition-colors"
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
                            className="p-1.5 text-txt-2 hover:text-ko hover:bg-ko-dim rounded transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )
        }
    ], [currentUser, onDeleteUser, onUpdateUser]);

    const renderUserCard = (user: User) => (
        <div className="bg-surface p-4 rounded-xl shadow-sm border border-line flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-txt-2 font-bold border-2 border-white shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-txt text-base">{user.name}</h3>
                        <div className="text-xs text-txt-2 flex items-center gap-1">
                            <Mail size={12} /> {user.email}
                        </div>
                    </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${user.active
                    ? 'bg-ok-dim text-ok border-ok-border'
                    : 'bg-ko-dim text-ko border-ko-border'
                    }`}>
                    {user.active ? 'Activo' : 'Inactivo'}
                </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1 ${getRoleColor(user.role)}`}>
                    <Shield size={12} /> {user.role}
                </span>
                {user.role === UserRole.ADMIN ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-accent-dim text-accent border border-accent-border font-medium">
                        Acceso Global
                    </span>
                ) : (
                    user.sections.map(s => (
                        <span key={s} className="px-2 py-0.5 rounded text-xs bg-surface-2 text-txt-2 border border-line">
                            {s}
                        </span>
                    ))
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                    onClick={() => openEditUser(user)}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg border border-line text-txt-2 hover:bg-surface-2 text-sm font-medium transition-colors"
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
                        className="flex items-center justify-center gap-2 py-2 rounded-lg border border-ko-border text-ko hover:bg-ko-dim text-sm font-medium transition-colors"
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
                <div className="font-medium text-txt flex items-center gap-2">
                    <Building2 size={18} className="text-txt-3" />
                    {section.name}
                </div>
            )
        },
        {
            header: "Usuarios Asignados",
            sortKey: "count",
            render: (item: Section & { count: number }) => (
                <div className="flex items-center gap-2 text-txt-2">
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
                            ? 'bg-warn-dim text-warn border-warn-border   '
                            : 'bg-surface-2 text-txt-2 border-line    hover:bg-surface-3 '
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
            header: "Comodín",
            render: (item: Section & { count: number }) => {
                const isWildcard = item.isWildcard;
                return (
                    <button
                        onClick={async (e) => {
                            e.stopPropagation();
                            await onEditSection({ ...item, isWildcard: !isWildcard });
                        }}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all border ${isWildcard
                            ? 'bg-ok-dim text-ok border-ok-border'
                            : 'bg-surface-2 text-txt-2 border-line    hover:bg-surface-3 '
                            }`}
                        title="Sección comodín: sus usuarios ven y gestionan TODAS las incidencias (no aplica a observadores)"
                    >
                        {isWildcard ? <Check size={12} /> : <X size={12} />}
                        {isWildcard ? 'Comodín' : 'Normal'}
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
                        className="p-1.5 text-txt-2 hover:text-accent hover:bg-accent-dim rounded transition-colors"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => setConfirmAction({
                            title: 'Eliminar sección',
                            message: `¿Estás seguro de eliminar la sección "${item.name}"?`,
                            onConfirm: () => onDeleteSection(item.id)
                        })}
                        className="p-1.5 text-txt-2 hover:text-ko hover:bg-ko-dim rounded transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ], [onDeleteSection, onEditSection]);

    const renderSectionCard = (item: Section & { count: number }) => (
        <div className="bg-surface p-4 rounded-xl shadow-sm border border-line flex justify-between items-center">
            <div>
                <h3 className="font-bold text-txt flex items-center gap-2">
                    <Building2 size={18} className="text-accent" />
                    {item.name}
                </h3>
                <p className="text-sm text-txt-2 mt-1 flex items-center gap-1">
                    <UserCircle size={14} /> {item.count} usuarios activos
                </p>
                {item.isSpecial && (
                    <span className="text-[10px] bg-warn-dim text-warn px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">Especial</span>
                )}
                {item.isWildcard && (
                    <span className="text-[10px] bg-ok-dim text-ok px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block ml-1">Comodín</span>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={() => openEditSection(item)} className="p-2 text-txt-3 hover:text-accent bg-surface-2 rounded-lg">
                    <Edit2 size={16} />
                </button>
                <button
                    onClick={() => setConfirmAction({
                        title: 'Eliminar sección',
                        message: `¿Estás seguro de eliminar la sección "${item.name}"?`,
                        onConfirm: () => onDeleteSection(item.id)
                    })}
                    className="p-2 text-txt-3 hover:text-ko bg-surface-2 rounded-lg"
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

    // Categories
    const { incidentCategories } = useAppStore();

    const filteredCategories = useMemo(() => {
        const term = normalizeForSearch(searchTerm);
        return incidentCategories.filter(c => normalizeForSearch(c.name).includes(term));
    }, [incidentCategories, searchTerm]);

    const categoryVisibilitySummary = (c: IncidentCategory) => {
        if (c.visibleSections.length === 0 && c.visibleRoles.length === 0) return 'Todos los usuarios';
        const parts: string[] = [];
        if (c.visibleSections.length > 0) parts.push(c.visibleSections.join(', '));
        if (c.visibleRoles.length > 0) parts.push(c.visibleRoles.join(', '));
        return parts.join(' · ');
    };

    const categoryColumns = useMemo(() => [
        {
            header: "Nombre",
            sortKey: "name",
            render: (c: IncidentCategory) => (
                <div className="font-medium text-txt flex items-center gap-2">
                    <Tag size={18} className="text-accent" />
                    {c.name}
                </div>
            )
        },
        {
            header: "Visibilidad",
            render: (c: IncidentCategory) => (
                <span className="text-sm text-txt-2">{categoryVisibilitySummary(c)}</span>
            )
        },
        {
            header: "Estado",
            render: (c: IncidentCategory) => (
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.isActive
                    ? 'bg-ok-dim text-ok'
                    : 'bg-surface-2 text-txt-2  '
                    }`}>
                    {c.isActive ? 'Activa' : 'Inactiva'}
                </span>
            )
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (c: IncidentCategory) => (
                <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => { setEditingCategory(c); setShowCategoryModal(true); }}
                        className="p-1.5 text-txt-2 hover:text-accent hover:bg-accent-dim rounded transition-colors"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => setConfirmAction({
                            title: 'Eliminar categoría',
                            message: `¿Eliminar la categoría "${c.name}"? Las incidencias pasarán a "Avería".`,
                            onConfirm: () => deleteIncidentCategory(c.id)
                        })}
                        className="p-1.5 text-txt-2 hover:text-ko hover:bg-ko-dim rounded transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ], [deleteIncidentCategory]);

    const renderCategoryCard = (c: IncidentCategory) => (
        <div className="bg-surface p-4 rounded-xl shadow-sm border border-line">
            <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-txt flex items-center gap-2">
                    <Tag size={18} className="text-accent" />
                    {c.name}
                </h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${c.isActive
                    ? 'bg-ok-dim text-ok'
                    : 'bg-surface-2 text-txt-2  '
                    }`}>
                    {c.isActive ? 'Activa' : 'Inactiva'}
                </span>
            </div>
            <p className="text-xs text-txt-2 mb-3">{categoryVisibilitySummary(c)}</p>
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => { setEditingCategory(c); setShowCategoryModal(true); }}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg border border-line text-txt-2 hover:bg-surface-2 text-sm font-medium transition-colors"
                >
                    <Edit2 size={14} /> Editar
                </button>
                <button
                    onClick={() => setConfirmAction({
                        title: 'Eliminar categoría',
                        message: `¿Eliminar la categoría "${c.name}"? Las incidencias pasarán a "Avería".`,
                        onConfirm: () => deleteIncidentCategory(c.id)
                    })}
                    className="flex items-center justify-center gap-2 py-2 rounded-lg border border-ko-border text-ko hover:bg-ko-dim text-sm font-medium transition-colors"
                >
                    <Trash2 size={14} /> Eliminar
                </button>
            </div>
        </div>
    );

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
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg transition-colors bg-accent hover:bg-accent-2 shadow-accent/20"
                            >
                                <UserPlus size={18} />
                                <span>Nuevo Usuario</span>
                            </button>
                        )}

                        {activeTab === 'sections' && (
                            <button
                                onClick={() => setShowSectionModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg transition-colors bg-spec hover:bg-spec shadow-spec/20"
                            >
                                <Plus size={18} />
                                <span>Nueva Sección</span>
                            </button>
                        )}

                        {activeTab === 'skills' && (
                            <button
                                onClick={() => setShowSkillsModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg transition-colors bg-warn hover:bg-warn shadow-warn/20"
                            >
                                <Book size={18} />
                                <span>Gestionar Habilidades</span>
                            </button>
                        )}

                        {activeTab === 'categories' && (
                            <button
                                onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-lg transition-colors bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/20"
                            >
                                <Tag size={18} />
                                <span>Gestionar Categorías</span>
                            </button>
                        )}
                    </>
                }
            />

            <div className="flex bg-surface-2 p-1 rounded-lg inline-flex border border-line">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'users'
                        ? 'bg-surface  text-accent  shadow-sm'
                        : 'text-txt-2  hover:text-txt-2 '
                        }`}
                >
                    Usuarios
                </button>
                <button
                    onClick={() => setActiveTab('sections')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'sections'
                        ? 'bg-surface  text-spec  shadow-sm'
                        : 'text-txt-2  hover:text-txt-2 '
                        }`}
                >
                    Secciones
                </button>
                <button
                    onClick={() => setActiveTab('skills')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'skills'
                        ? 'bg-surface  text-warn  shadow-sm'
                        : 'text-txt-2  hover:text-txt-2 '
                        }`}
                >
                    Matriz de Polivalencia
                </button>
                <button
                    onClick={() => setActiveTab('categories')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'categories'
                        ? 'bg-surface  text-cyan-600  shadow-sm'
                        : 'text-txt-2  hover:text-txt-2 '
                        }`}
                >
                    Categorías
                </button>
            </div>

            {/* Search Bar & Filters */}
            {activeTab !== 'skills' && (
                <div className="bg-surface p-4 rounded-xl shadow-sm border border-line flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={20} />
                        <input
                            type="text"
                            placeholder={activeTab === 'users' ? "Buscar usuario por nombre, email..." : activeTab === 'categories' ? "Buscar categoría..." : "Buscar sección..."}
                            className="w-full pl-10 pr-4 py-2 border border-line-2 rounded-lg focus:ring-2 focus:ring-accent outline-none bg-surface text-txt transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Section Filter (Only visible in Users tab) */}
                    {activeTab === 'users' && (
                        <div className="w-full md:w-64">
                            <select
                                className="w-full p-2 border border-line-2 rounded-lg bg-surface text-txt focus:ring-2 focus:ring-accent outline-none transition-colors"
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
                {activeTab === 'categories' && (
                    <GenericTable
                        data={filteredCategories}
                        columns={categoryColumns}
                        renderCard={renderCategoryCard}
                        itemsPerPage={25}
                        emptyMessage="No se encontraron categorías."
                    />
                )}
                {activeTab === 'skills' && (
                    <SkillsMatrix users={users} refreshTrigger={skillsRefreshTrigger} />
                )}
            </div>

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-2xl w-full max-w-lg shadow-2xl border border-line overflow-hidden">
                        <div className="p-6 border-b border-line flex justify-between items-center bg-surface-2">
                            <h2 className="text-xl font-bold text-txt">
                                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h2>
                            <button 
                                onClick={() => { setShowUserModal(false); setEditingUser(null); }} 
                                    className="p-2 bg-surface-2 text-txt-3 hover:text-txt-2 rounded-xl transition-all active:scale-95 border border-line shadow-sm"
                                >
                                    <X size={20} className="sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-txt-2 mb-1">Nombre Completo</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-2 rounded-lg border border-line-2 bg-surface text-txt focus:ring-2 focus:ring-accent outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-txt-2 mb-1">Email</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full px-4 py-2 rounded-lg border border-line-2 bg-surface text-txt focus:ring-2 focus:ring-accent outline-none"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-txt-2 mb-1">Contraseña inicial</label>
                                    <input
                                        required
                                        type="text"
                                        autoComplete="new-password"
                                        className="w-full px-4 py-2 rounded-lg border border-line-2 bg-surface text-txt focus:ring-2 focus:ring-accent outline-none"
                                        value={formPassword}
                                        onChange={e => setFormPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                    <p className="mt-1 text-xs text-txt-3">
                                        Comunícasela al usuario. Podrá cambiarla en el futuro.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-txt-2 mb-1">Rol</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-lg border border-line-2 bg-surface text-txt focus:ring-2 focus:ring-accent outline-none"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    >
                                        {Object.values(UserRole).map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-txt-2 mb-1">Estado</label>
                                    <div className="flex items-center h-[42px] px-2">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={formData.active}
                                                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                            <span className="ml-3 text-sm font-medium text-txt-2">
                                                {formData.active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-txt-2 mb-2">Asignar Secciones</label>
                                {formData.role === UserRole.ADMIN ? (
                                    <div className="p-3 bg-accent-dim border border-accent-border rounded-lg text-sm text-accent flex items-center gap-2">
                                        <Shield size={16} />
                                        Los administradores tienen acceso automático a todas las secciones.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-line rounded-lg custom-scrollbar">
                                        {sections.map(sec => (
                                            <label key={sec.id} className="flex items-center gap-2 text-sm text-txt-2 cursor-pointer p-1 hover:bg-surface-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.sections?.includes(sec.name)}
                                                    onChange={e => {
                                                        const current = formData.sections || [];
                                                        if (e.target.checked) setFormData({ ...formData, sections: [...current, sec.name] });
                                                        else setFormData({ ...formData, sections: current.filter(s => s !== sec.name) });
                                                    }}
                                                    className="rounded border-line-2 text-accent focus:ring-accent"
                                                />
                                                {sec.name}
                                            </label>
                                        ))}
                                        {sections.length === 0 && <span className="text-xs text-txt-3 p-1">No hay secciones disponibles</span>}
                                    </div>
                                )}
                            </div>

                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-txt-2 mb-2">
                                        Copiar permisos de (opcional)
                                    </label>
                                    <select
                                        className="w-full p-2 border border-line-2 rounded-lg bg-surface text-txt focus:ring-2 focus:ring-accent outline-none text-sm"
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

                            <div className="pt-4 flex justify-end gap-3 border-t border-line mt-2">
                                <button type="button" onClick={() => { setShowUserModal(false); setEditingUser(null); }} className="px-4 py-2 text-txt-2 hover:bg-surface-2 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-2 transition-colors shadow-lg shadow-accent/20">
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
                    <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl border border-line overflow-hidden">
                        <div className="p-4 border-b border-line flex justify-between items-center bg-surface-2">
                            <h3 className="font-bold text-txt">{editingSection ? 'Editar Sección' : 'Nueva Sección'}</h3>
                            <button 
                                onClick={() => setShowSectionModal(false)}
                                className="p-2 bg-surface-2 text-txt-3 hover:text-txt-2 rounded-xl transition-all active:scale-95 border border-line shadow-sm"
                            >
                                <X size={20} className="sm:size-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSectionSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-txt-2 mb-1">Nombre</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Nombre de la sección..."
                                    className="w-full px-4 py-2 rounded-lg border border-line-2 bg-surface text-txt focus:ring-2 focus:ring-spec outline-none"
                                    value={sectionName}
                                    onChange={e => setSectionName(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => { setShowSectionModal(false); setEditingSection(null); }} className="px-4 py-2 text-txt-2 hover:bg-surface-2 rounded-lg transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={!sectionName.trim()} className="px-4 py-2 bg-spec text-white rounded-lg hover:bg-spec disabled:opacity-50 transition-colors shadow-lg shadow-spec/20">
                                    {editingSection ? 'Guardar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showSkillsModal && (
                <SkillsManagementModal
                    isOpen={showSkillsModal}
                    onClose={() => setShowSkillsModal(false)}
                    onSkillsChange={() => setSkillsRefreshTrigger(prev => prev + 1)}
                />
            )}

            {showCategoryModal && (
                <CategoriesManagementModal
                    isOpen={showCategoryModal}
                    onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
                    editingCategory={editingCategory}
                />
            )}

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