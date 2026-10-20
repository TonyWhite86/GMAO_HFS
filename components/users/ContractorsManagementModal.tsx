import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, Save, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Contractor } from '../../types';
import { Modal } from '../ui/Modal';
import { useAppStore } from '../../store/useAppStore';

interface ContractorsManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingContractor: Contractor | null;
}

export const ContractorsManagementModal: React.FC<ContractorsManagementModalProps> = ({ isOpen, onClose, editingContractor }) => {
    const {
        contractors,
        addContractor,
        updateContractor,
        deleteContractor
    } = useAppStore();

    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [notes, setNotes] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(editingContractor?.name || '');
            setContact(editingContractor?.contact || '');
            setPhone(editingContractor?.phone || '');
            setEmail(editingContractor?.email || '');
            setNotes(editingContractor?.notes || '');
            setIsActive(editingContractor?.active ?? true);
            setEditingId(editingContractor?.id ?? null);
        }
    }, [isOpen, editingContractor]);

    const resetForm = () => {
        setName(''); setContact(''); setPhone(''); setEmail(''); setNotes(''); setIsActive(true);
        setEditingId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Indica el nombre de la contrata');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                contact: contact.trim() || null,
                phone: phone.trim() || null,
                email: email.trim() || null,
                notes: notes.trim() || null,
                active: isActive
            };
            if (editingId) {
                await updateContractor(editingId, payload);
                resetForm();
            } else {
                await addContractor(payload);
                resetForm();
            }
        } catch {
            // el slice ya muestra el toast
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (c: Contractor) => {
        if (!window.confirm(`¿Eliminar la contrata "${c.name}"? Las OTs que la referencian quedarán sin contrata.`)) return;
        try {
            await deleteContractor(c.id);
        } catch {
            // el slice ya muestra el toast
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header onClose={onClose} icon={<Building2 size={22} />}>
                Contratas
            </Modal.Header>
            <Modal.Body>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Nombre *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nombre de la empresa o contrata"
                            className="fld-input w-full p-3 rounded-[6px] outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Persona de contacto</label>
                            <input
                                type="text"
                                value={contact}
                                onChange={(e) => setContact(e.target.value)}
                                className="fld-input w-full p-3 rounded-[6px] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Teléfono</label>
                            <input
                                type="text"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="fld-input w-full p-3 rounded-[6px] outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="fld-input w-full p-3 rounded-[6px] outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Notas</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="fld-input w-full p-3 rounded-[6px] outline-none resize-none"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-txt-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="w-4 h-4"
                        />
                        Activa (disponible para nuevas OTs)
                    </label>
                    <div className="flex gap-2">
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                            <Save size={16} />
                            {editingId ? 'Guardar cambios' : 'Añadir contrata'}
                        </button>
                        {editingId && (
                            <button type="button" onClick={resetForm} className="btn btn-ghost">
                                <X size={16} />
                                Limpiar
                            </button>
                        )}
                    </div>
                </form>

                <div className="mt-6">
                    <h4 className="text-xs font-bold text-txt-3 uppercase tracking-wider mb-3">Contratas registradas</h4>
                    <div className="space-y-2">
                        {contractors.length === 0 && (
                            <p className="text-sm text-txt-3 italic">Todavía no hay contratas.</p>
                        )}
                        {contractors.map((c) => (
                            <div
                                key={c.id}
                                className="flex items-center gap-3 p-3 rounded-[10px] border border-line bg-surface-2"
                            >
                                <Building2 size={18} className={c.active ? 'text-accent' : 'text-txt-3'} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-txt truncate">
                                        {c.name}
                                        {!c.active && <span className="bdg bdg-gray ml-2">Inactiva</span>}
                                    </p>
                                    <p className="text-xs text-txt-2 truncate">
                                        {[c.contact, c.phone, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setName(c.name); setContact(c.contact || ''); setPhone(c.phone || '');
                                        setEmail(c.email || ''); setNotes(c.notes || ''); setIsActive(c.active);
                                        setEditingId(c.id);
                                    }}
                                    className="btn btn-ghost btn-icon"
                                    title="Editar"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => handleDelete(c)}
                                    className="btn btn-danger btn-icon"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
};
