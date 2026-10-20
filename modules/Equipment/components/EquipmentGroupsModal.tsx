import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Building2, Save, X, Pencil, Search, Cog } from 'lucide-react';
import { toast } from 'sonner';
import { EquipmentGroup } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { useAppStore } from '../../../store/useAppStore';
import { normalizeForSearch } from '../../../utils/searchUtils';

interface EquipmentGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const EquipmentGroupsModal: React.FC<EquipmentGroupsModalProps> = ({ isOpen, onClose }) => {
    const {
        equipmentGroups, equipment, addEquipmentGroup, updateEquipmentGroup, deleteEquipmentGroup
    } = useAppStore();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [members, setMembers] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && editingId) {
            const g = equipmentGroups.find(x => x.id === editingId);
            if (g) {
                setName(g.name);
                setDescription(g.description || '');
                setMembers([...g.equipmentIds]);
            }
        }
    }, [isOpen, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

    const visibleEquipment = useMemo(() =>
        equipment
            .filter(e => !search.trim() || normalizeForSearch(`${e.name} ${e.code || ''}`).includes(normalizeForSearch(search)))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [equipment, search]
    );

    const resetForm = () => {
        setName(''); setDescription(''); setMembers([]); setSearch(''); setEditingId(null);
    };

    const toggleMember = (id: string) =>
        setMembers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Indica el nombre del grupo');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || null,
                equipmentIds: members,
                active: true
            };
            if (editingId) {
                await updateEquipmentGroup(editingId, payload);
                resetForm();
            } else {
                await addEquipmentGroup(payload);
                resetForm();
            }
        } catch {
            // el slice muestra el error
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (g: EquipmentGroup) => {
        if (!window.confirm(`¿Eliminar el grupo "${g.name}"? Sus miembros conservarán los planes preventivos ya asignados.`)) return;
        try {
            await deleteEquipmentGroup(g.id);
            if (editingId === g.id) resetForm();
        } catch {
            // el slice muestra el error
        }
    };

    if (!isOpen) return null;

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header onClose={onClose} icon={<Building2 size={22} />}>
                Grupos de equipos
            </Modal.Header>
            <Modal.Body>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Nombre del grupo *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Detectores de metales"
                            className="fld-input w-full p-3 rounded-[6px] outline-none"
                            disabled={!!editingId === false && false}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Descripción</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="fld-input w-full p-3 rounded-[6px] outline-none"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider">
                                Equipos miembros ({members.length})
                            </label>
                            <div className="relative w-48">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-3" size={14} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar equipo…"
                                    className="fld-input w-full pl-8 pr-2 py-1.5 rounded-[6px] outline-none text-xs"
                                />
                            </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-[10px] border border-line divide-y divide-line">
                            {visibleEquipment.length > 0 ? visibleEquipment.map(eq => (
                                <label
                                    key={eq.id}
                                    className={`flex items-center gap-2.5 p-2.5 cursor-pointer transition-colors ${members.includes(eq.id) ? 'bg-accent-dim' : 'hover:bg-surface-2'}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={members.includes(eq.id)}
                                        onChange={() => toggleMember(eq.id)}
                                        className="w-4 h-4"
                                    />
                                    <Cog size={15} className="text-txt-2 shrink-0" />
                                    <span className="text-sm text-txt truncate flex-1">{eq.name}</span>
                                    {eq.code && <span className="text-[10px] text-txt-3 font-mono shrink-0">{eq.code}</span>}
                                </label>
                            )) : (
                                <p className="p-4 text-xs text-txt-3 text-center">
                                    {search ? 'Ningún equipo coincide' : 'No hay equipos registrados.'}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                            <Save size={16} />
                            {editingId ? 'Guardar cambios' : 'Crear grupo'}
                        </button>
                        {editingId && (
                            <button type="button" onClick={resetForm} className="btn btn-ghost">
                                <X size={16} />
                                Volver
                            </button>
                        )}
                    </div>
                </form>

                <div className="mt-6">
                    <h4 className="text-xs font-bold text-txt-3 uppercase tracking-wider mb-3">Grupos registrados</h4>
                    <div className="space-y-2">
                        {equipmentGroups.length === 0 && (
                            <p className="text-sm text-txt-3 italic">
                                Todavía no hay grupos. Crea uno para aplicar planes preventivos a varios equipos de golpe.
                            </p>
                        )}
                        {equipmentGroups.map((g) => (
                            <div
                                key={g.id}
                                className="flex items-center gap-3 p-3 rounded-[10px] border border-line bg-surface-2"
                            >
                                <Building2 size={18} className={g.active ? 'text-accent' : 'text-txt-3'} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-txt truncate">
                                        {g.name}
                                        {!g.active && <span className="bdg bdg-gray ml-2">Inactivo</span>}
                                    </p>
                                    <p className="text-xs text-txt-2 truncate">
                                        {g.equipmentIds.length} equipo{g.equipmentIds.length === 1 ? '' : 's'}
                                        {g.description ? ` · ${g.description}` : ''}
                                    </p>
                                </div>
                                <button onClick={() => setEditingId(g.id)} className="btn btn-ghost btn-icon" title="Editar">
                                    <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDelete(g)} className="btn btn-danger btn-icon" title="Eliminar">
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
