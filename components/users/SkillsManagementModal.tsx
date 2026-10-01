import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Book } from 'lucide-react';
import { toast } from 'sonner';
import { skillsService } from '../../services/skillsService';
import { Skill } from '../../types';
import { Modal } from '../ui/Modal';

interface SkillsManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSkillsChange: () => void; // Trigger refresh in parent
}

export const SkillsManagementModal: React.FC<SkillsManagementModalProps> = ({ isOpen, onClose, onSkillsChange }) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(false);
    const [newSkillName, setNewSkillName] = useState('');
    const [newSkillCategory, setNewSkillCategory] = useState('Mecánica');
    const [newSkillDesc, setNewSkillDesc] = useState('');

    const categories = ['Mecánica', 'Electricidad', 'Hidráulica', 'Neumática', 'Gestión', 'Mantenimiento Preventivo', 'Software', 'Otros'];

    useEffect(() => {
        if (isOpen) {
            loadSkills();
        }
    }, [isOpen]);

    const loadSkills = async () => {
        setLoading(true);
        try {
            const data = await skillsService.getSkills();
            setSkills(data);
        } catch (error) {
            toast.error('Error al cargar habilidades');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSkill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSkillName.trim()) return;

        try {
            await skillsService.addSkill({
                name: newSkillName,
                category: newSkillCategory,
                description: newSkillDesc
            });
            toast.success('Habilidad creada');
            setNewSkillName('');
            setNewSkillDesc('');
            loadSkills();
            onSkillsChange();
        } catch (error) {
            toast.error('Error al crear habilidad');
        }
    };

    const handleDeleteSkill = async (id: string) => {
        if (!confirm('¿Estás seguro? Se borrarán todas las puntuaciones asociadas a esta habilidad.')) return;
        try {
            await skillsService.deleteSkill(id);
            toast.success('Habilidad eliminada');
            loadSkills();
            onSkillsChange();
        } catch (error) {
            toast.error('Error al eliminar habilidad');
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Book size={20} /></div>}
            >
                Gestión de Habilidades
            </Modal.Header>

            <Modal.Body>
                {/* Create Form */}
                <form onSubmit={handleCreateSkill} className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Nueva Habilidad</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                            <input
                                type="text"
                                value={newSkillName}
                                onChange={(e) => setNewSkillName(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Ej. Soldadura TIG"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Categoría</label>
                            <select
                                value={newSkillCategory}
                                onChange={(e) => setNewSkillCategory(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Descripción (Opcional)</label>
                        <input
                            type="text"
                            value={newSkillDesc}
                            onChange={(e) => setNewSkillDesc(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Breve descripción..."
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} />
                            Añadir Habilidad
                        </button>
                    </div>
                </form>

                {/* Skills List */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Habilidades Existentes ({skills.length})</h3>
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Cargando...</div>
                    ) : skills.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            No hay habilidades definidas
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {skills.map(skill => (
                                <div key={skill.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-shadow">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                            <Tag size={18} />
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-white">{skill.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-2">
                                                <span className="font-semibold text-slate-600 dark:text-slate-300">{skill.category}</span>
                                                {skill.description && <span>• {skill.description}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteSkill(skill.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal.Body>
        </Modal>
    );
};
