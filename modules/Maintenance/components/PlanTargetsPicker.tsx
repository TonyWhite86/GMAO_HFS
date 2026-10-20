import React, { useMemo, useState } from 'react';
import { Search, Building2, Cog, Package } from 'lucide-react';
import { Equipment, EquipmentGroup } from '../../../types';
import { normalizeForSearch } from '../../../utils/searchUtils';

interface PlanTargetsPickerProps {
    equipment: Equipment[];
    groups: EquipmentGroup[];
    selectedEquipment: string[];
    selectedGroups: string[];
    staggerDays: number;
    disabled?: boolean;
    onEquipmentChange: (ids: string[]) => void;
    onGroupsChange: (ids: string[]) => void;
    onStaggerChange: (days: number) => void;
}

export const PlanTargetsPicker: React.FC<PlanTargetsPickerProps> = ({
    equipment, groups, selectedEquipment, selectedGroups, staggerDays, disabled,
    onEquipmentChange, onGroupsChange, onStaggerChange
}) => {
    const [tab, setTab] = useState<'equipment' | 'groups'>('groups');
    const [search, setSearch] = useState('');

    const visibleEquipment = useMemo(() =>
        equipment
            .filter(e => !search.trim() || normalizeForSearch(`${e.name} ${e.code || ''}`).includes(normalizeForSearch(search)))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [equipment, search]
    );
    const visibleGroups = useMemo(() =>
        groups
            .filter(g => g.active)
            .filter(g => !search.trim() || normalizeForSearch(g.name).includes(normalizeForSearch(search)))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [groups, search]
    );

    const toggleEquipment = (id: string) => {
        if (disabled) return;
        onEquipmentChange(selectedEquipment.includes(id)
            ? selectedEquipment.filter(x => x !== id)
            : [...selectedEquipment, id]);
    };
    const toggleGroup = (id: string) => {
        if (disabled) return;
        onGroupsChange(selectedGroups.includes(id)
            ? selectedGroups.filter(x => x !== id)
            : [...selectedGroups, id]);
    };

    const groupMemberCount = (g: EquipmentGroup) => g.equipmentIds.length;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider">
                    <Package size={14} />
                    Equipos objetivo
                </label>
                <div className="tabs">
                    <button type="button" onClick={() => setTab('groups')} className={`tab ${tab === 'groups' ? 'active' : ''}`}>
                        <Building2 size={12} className="mr-1 inline -mt-0.5" />
                        Grupos
                    </button>
                    <button type="button" onClick={() => setTab('equipment')} className={`tab ${tab === 'equipment' ? 'active' : ''}`}>
                        <Cog size={12} className="mr-1 inline -mt-0.5" />
                        Equipos
                    </button>
                </div>
            </div>

            {/* Resumen de selección */}
            <div className="flex flex-wrap items-center gap-1.5">
                {selectedGroups.map(gid => {
                    const g = groups.find(x => x.id === gid);
                    if (!g) return null;
                    return (
                        <span key={gid} className="bdg bdg-accent">
                            <Building2 size={11} />
                            {g.name} · {groupMemberCount(g)}
                            {!disabled && (
                                <button type="button" onClick={() => toggleGroup(gid)} className="ml-1">×</button>
                            )}
                        </span>
                    );
                })}
                {selectedEquipment.length > 0 && (
                    <span className="bdg bdg-gray">
                        <Cog size={11} />
                        {selectedEquipment.length} equipo{selectedEquipment.length === 1 ? '' : 's'} suelto{selectedEquipment.length === 1 ? '' : 's'}
                        {!disabled && (
                            <button type="button" onClick={() => onEquipmentChange([])} className="ml-1">×</button>
                        )}
                    </span>
                )}
                {selectedGroups.length === 0 && selectedEquipment.length === 0 && (
                    <span className="text-xs text-txt-3 italic">Sin objetivos seleccionados</span>
                )}
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" size={16} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={tab === 'groups' ? 'Buscar grupo…' : 'Buscar equipo…'}
                    className="fld-input w-full pl-9 pr-3 py-2 rounded-[6px] outline-none text-sm"
                    disabled={disabled}
                />
            </div>

            {/* Lista */}
            <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-[10px] border border-line divide-y divide-line">
                {tab === 'groups' ? (
                    visibleGroups.length > 0 ? visibleGroups.map(g => (
                        <label key={g.id} className={`flex items-center gap-2.5 p-2.5 cursor-pointer transition-colors ${selectedGroups.includes(g.id) ? 'bg-accent-dim' : 'hover:bg-surface-2'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
                            <input
                                type="checkbox"
                                checked={selectedGroups.includes(g.id)}
                                onChange={() => toggleGroup(g.id)}
                                className="w-4 h-4"
                            />
                            <Building2 size={15} className="text-txt-2 shrink-0" />
                            <span className="text-sm text-txt truncate flex-1">{g.name}</span>
                            <span className="text-[10px] text-txt-3 shrink-0">{groupMemberCount(g)} equipos</span>
                        </label>
                    )) : (
                        <p className="p-4 text-xs text-txt-3 text-center">
                            {search ? 'Ningún grupo coincide' : 'No hay grupos creados — crea uno en Equipos → Grupos.'}
                        </p>
                    )
                ) : (
                    visibleEquipment.length > 0 ? visibleEquipment.map(eq => (
                        <label key={eq.id} className={`flex items-center gap-2.5 p-2.5 cursor-pointer transition-colors ${selectedEquipment.includes(eq.id) ? 'bg-accent-dim' : 'hover:bg-surface-2'} ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
                            <input
                                type="checkbox"
                                checked={selectedEquipment.includes(eq.id)}
                                onChange={() => toggleEquipment(eq.id)}
                                className="w-4 h-4"
                            />
                            <Cog size={15} className="text-txt-2 shrink-0" />
                            <span className="text-sm text-txt truncate flex-1">{eq.name}</span>
                            {eq.code && <span className="text-[10px] text-txt-3 font-mono shrink-0">{eq.code}</span>}
                        </label>
                    )) : (
                        <p className="p-4 text-xs text-txt-3 text-center">
                            {search ? 'Ningún equipo coincide' : 'No hay equipos disponibles.'}
                        </p>
                    )
                )}
            </div>

            {/* Arranque */}
            <div className="flex items-center gap-3 flex-wrap p-3 rounded-[10px] bg-surface-2 border border-line">
                <span className="text-xs font-bold text-txt-2 uppercase tracking-wider">Arranque</span>
                <label className="flex items-center gap-1.5 text-sm text-txt-2 cursor-pointer">
                    <input
                        type="radio"
                        checked={staggerDays === 0}
                        onChange={() => onStaggerChange(0)}
                        disabled={disabled}
                    />
                    Todos a la vez
                </label>
                <label className="flex items-center gap-1.5 text-sm text-txt-2 cursor-pointer">
                    <input
                        type="radio"
                        checked={staggerDays > 0}
                        onChange={() => onStaggerChange(staggerDays || 1)}
                        disabled={disabled}
                    />
                    Escalonado cada
                    <input
                        type="number"
                        min={1}
                        value={staggerDays || ''}
                        onChange={(e) => onStaggerChange(Math.max(1, Number(e.target.value) || 1))}
                        disabled={disabled || staggerDays === 0}
                        className="fld-input w-16 px-2 py-1 rounded-[6px] text-center text-sm"
                    />
                    días
                </label>
            </div>
        </div>
    );
};
