import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { IncidentCategory, UserRole } from '../../types';
import { Modal } from '../ui/Modal';
import { useAppStore } from '../../store/useAppStore';

interface CategoriesManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingCategory: IncidentCategory | null;
}

const ALL_ROLES = Object.values(UserRole);

export const CategoriesManagementModal: React.FC<CategoriesManagementModalProps> = ({ isOpen, onClose, editingCategory }) => {
    const {
        incidentCategories,
        sections,
        addIncidentCategory,
        updateIncidentCategory,
        deleteIncidentCategory
    } = useAppStore();

    const [name, setName] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [isDefault, setIsDefault] = useState(false);
    const [visibleSections, setVisibleSections] = useState<string[]>([]);
    const [visibleRoles, setVisibleRoles] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(editingCategory?.name || '');
            setIsActive(editingCategory?.isActive ?? true);
            setIsDefault(editingCategory?.isDefault ?? false);
            setVisibleSections(editingCategory?.visibleSections || []);
            setVisibleRoles(editingCategory?.visibleRoles || []);
        }
    }, [isOpen, editingCategory]);

    if (!isOpen) return null;

    const toggle = (list: string[], value: string, set: (v: string[]) => void) => {
        set(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Indica el nombre de la categoría');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                isActive,
                isDefault,
                visibleSections,
                visibleRoles
            };
            if (editingCategory) {
                await updateIncidentCategory(editingCategory.id, payload);
            } else {
                await addIncidentCategory({ ...payload, sortOrder: incidentCategories.length + 1 });
                setName('');
                setIsActive(true);
                setIsDefault(false);
                setVisibleSections([]);
                setVisibleRoles([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (category: IncidentCategory) => {
        if (!window.confirm(`¿Eliminar la categoría "${category.name}"? Las incidencias pasarán a "Avería".`)) return;
        try {
            await deleteIncidentCategory(category.id);
        } catch (error) {
            console.error(error);
        }
    };

    const visibilitySummary = (c: IncidentCategory) => {
        if (c.visibleSections.length === 0 && c.visibleRoles.length === 0) return 'Todos los usuarios';
        const parts: string[] = [];
        if (c.visibleSections.length > 0) parts.push(c.visibleSections.join(', '));
        if (c.visibleRoles.length > 0) parts.push(c.visibleRoles.join(', '));
        return parts.join(' · ');
    };

    return (
        <Modal onClose={onClose}>
            <Modal.Header onClose={onClose} icon={<Tag size={24} className="text-blue-500" />}>
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría de Incidencia'}
            </Modal.Header>

            <Modal.Body>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nombre *</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej. Falta de personal"
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 pb-2 cursor-pointer whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Activa
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 pb-2 cursor-pointer whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={isDefault}
                                onChange={(e) => setIsDefault(e.target.checked)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Por defecto
                        </label>
                    </div>
                    <p className="text-xs text-slate-400 -mt-3">
                        La categoría por defecto es la que se preselecciona al crear una incidencia. Solo puede haber una.
                    </p>

                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Visibilidad</p>
                        <p className="text-xs text-slate-400 mb-2">
                            Sin marcar nada, la categoría la ve todo el mundo. Si marcas secciones o roles, solo la verán esos usuarios (el Admin siempre ve todo).
                        </p>

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Secciones</p>
                        <div className="grid grid-cols-2 gap-1.5 mb-3 max-h-32 overflow-y-auto custom-scrollbar p-1">
                            {sections.map(s => (
                                <label key={s.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                    <input
                                        type="checkbox"
                                        checked={visibleSections.includes(s.name)}
                                        onChange={() => toggle(visibleSections, s.name, setVisibleSections)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    {s.name}
                                </label>
                            ))}
                            {sections.length === 0 && <span className="text-xs text-slate-400">No hay secciones</span>}
                        </div>

                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Roles</p>
                        <div className="grid grid-cols-2 gap-1.5 p-1">
                            {ALL_ROLES.map(role => (
                                <label key={role} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                    <input
                                        type="checkbox"
                                        checked={visibleRoles.includes(role)}
                                        onChange={() => toggle(visibleRoles, role, setVisibleRoles)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    {role}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        {!editingCategory && name.trim() && (
                            <button
                                type="button"
                                onClick={() => {
                                    setName('');
                                    setVisibleSections([]);
                                    setVisibleRoles([]);
                                }}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm"
                            >
                                Limpiar
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                        >
                            {editingCategory ? <Save size={16} /> : <Plus size={16} />}
                            {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                        </button>
                    </div>
                </form>

                {!editingCategory && (
                    <div className="mt-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Categorías existentes</p>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                            {incidentCategories.map(c => (
                                <div key={c.id} className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                            {c.name}
                                            {c.isDefault && (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">Por defecto</span>
                                            )}
                                            {!c.isActive && (
                                                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">Inactiva</span>
                                            )}
                                        </p>
                                        <p className="text-[11px] text-slate-400 truncate">{visibilitySummary(c)}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(c)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                            {incidentCategories.length === 0 && (
                                <p className="text-xs text-slate-400">No hay categorías creadas</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal.Body>

            <Modal.Footer>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
                >
                    <X size={16} />
                    Cerrar
                </button>
            </Modal.Footer>
        </Modal>
    );
};
