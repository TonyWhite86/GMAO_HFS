import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ClipboardCheck, Save, X, Pencil, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { ChecklistItem, ChecklistTemplate } from '../../types';
import { Modal } from '../ui/Modal';
import { useAppStore } from '../../store/useAppStore';

interface ChecklistTemplatesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

let seq = 0;
const newItem = (text = ''): ChecklistItem => ({
    id: `cl-${Date.now()}-${seq++}`,
    text
});

export const ChecklistTemplatesModal: React.FC<ChecklistTemplatesModalProps> = ({ isOpen, onClose }) => {
    const {
        checklistTemplates,
        updateChecklistTemplate,
        deleteChecklistTemplate
    } = useAppStore();

    const [name, setName] = useState('');
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [isActive, setIsActive] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && editingId) {
            const tpl = checklistTemplates.find(t => t.id === editingId);
            if (tpl) {
                setName(tpl.name);
                setItems(tpl.items.map(it => newItem(it.text)));
                setIsActive(tpl.active);
            }
        }
    }, [isOpen, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

    const resetForm = () => {
        setName(''); setItems([]); setIsActive(true); setEditingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Indica el nombre de la plantilla');
            return;
        }
        if (!editingId) return;
        setIsSubmitting(true);
        try {
            await updateChecklistTemplate(editingId, {
                name: name.trim(),
                items: items.filter(it => it.text.trim()),
                active: isActive
            });
            resetForm();
        } catch {
            // el slice muestra el error
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (t: ChecklistTemplate) => {
        if (!window.confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
        try {
            await deleteChecklistTemplate(t.id);
            if (editingId === t.id) resetForm();
        } catch {
            // el slice muestra el error
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header onClose={onClose} icon={<FolderOpen size={22} />}>
                Plantillas de checklist
            </Modal.Header>
            <Modal.Body>
                {editingId ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Nombre *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="fld-input w-full p-3 rounded-[6px] outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider">Puntos</label>
                            {items.map((item, idx) => (
                                <div key={item.id} className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-txt-3 w-5 text-right shrink-0">{idx + 1}.</span>
                                    <input
                                        type="text"
                                        value={item.text}
                                        onChange={(e) => setItems(items.map(it => it.id === item.id ? { ...it, text: e.target.value } : it))}
                                        className="fld-input flex-1 px-3 py-2 rounded-[6px] outline-none text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setItems(items.filter(it => it.id !== item.id))}
                                        className="btn btn-ghost btn-icon shrink-0"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => setItems([...items, newItem()])}
                                className="btn btn-ghost btn-sm"
                            >
                                <Plus size={13} />
                                Añadir punto
                            </button>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-txt-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="w-4 h-4"
                            />
                            Activa (disponible al crear/editar OTs)
                        </label>

                        <div className="flex gap-2">
                            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                                <Save size={16} />
                                Guardar cambios
                            </button>
                            <button type="button" onClick={resetForm} className="btn btn-ghost">
                                <X size={16} />
                                Volver
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-2">
                        {checklistTemplates.length === 0 && (
                            <p className="text-sm text-txt-3 italic">
                                Todavía no hay plantillas. Guárdalas desde el editor de checklist de una OT.
                            </p>
                        )}
                        {checklistTemplates.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-3 p-3 rounded-[10px] border border-line bg-surface-2"
                            >
                                <ClipboardCheck size={18} className={t.active ? 'text-accent' : 'text-txt-3'} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-txt truncate">
                                        {t.name}
                                        {!t.active && <span className="bdg bdg-gray ml-2">Inactiva</span>}
                                    </p>
                                    <p className="text-xs text-txt-2 truncate">
                                        {t.items.length} punto{t.items.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setEditingId(t.id)}
                                    className="btn btn-ghost btn-icon"
                                    title="Editar"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(t)}
                                    className="btn btn-danger btn-icon"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};
