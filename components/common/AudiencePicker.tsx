import React, { useState } from 'react';
import { Plus, X, Users, UserPlus } from 'lucide-react';
import { Section, User, UserRole } from '../../types';
import { canBeAssignedToWO } from '../../utils/incidentVisibility';

interface AudiencePickerProps {
    sections: Section[];
    users: User[];
    /** Sección principal del trabajo (para no ofrecerla como colaboradora). */
    mainSection: string;
    collaboratingSections: string[];
    onCollaboratingSectionsChange: (sections: string[]) => void;
    collaborators: string[];
    onCollaboratorsChange: (ids: string[]) => void;
    disabled?: boolean;
}

/**
 * Pickers de audiencia de un trabajo (OT, actuación o plan preventivo):
 * secciones colaboradoras (ven y gestionan) + colaboradores (siguen el caso).
 * Patrón común de CreateWorkOrderModal / CreatePlannedModal / CreatePreventiveModal.
 */
export const AudiencePicker: React.FC<AudiencePickerProps> = ({
    sections,
    users,
    mainSection,
    collaboratingSections,
    onCollaboratingSectionsChange,
    collaborators,
    onCollaboratorsChange,
    disabled = false
}) => {
    const [isAddingSection, setIsAddingSection] = useState(false);
    const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);

    const availableSections = sections.filter(
        s => s.name !== mainSection && !collaboratingSections.includes(s.name)
    );
    const availableUsers = users.filter(u =>
        u.role !== UserRole.OBSERVER_L1 && u.role !== UserRole.OBSERVER_L2
        && !collaborators.includes(u.id)
        && canBeAssignedToWO(u, mainSection, collaboratingSections, sections)
    );

    return (
        <>
            {/* Secciones Colaboradoras */}
            <div>
                <label className="block text-sm font-medium text-txt-2 mb-2 flex items-center gap-2">
                    <Users size={16} /> Secciones Colaboradoras
                </label>
                <div className="flex flex-wrap gap-2 items-center min-h-[42px] p-2 bg-surface-2 border border-line rounded-lg">
                    {collaboratingSections.map(sec => (
                        <span key={sec} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-dim text-accent border border-accent-border">
                            {sec}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => onCollaboratingSectionsChange(collaboratingSections.filter(x => x !== sec))}
                                    className="hover:text-ko transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </span>
                    ))}
                    {!disabled && (
                        <div className="relative">
                            <button
                                type="button"
                                className={`p-1.5 rounded-full transition-all ${isAddingSection ? 'bg-accent text-white' : 'bg-surface text-accent border border-accent-border hover:bg-accent-dim'}`}
                                onClick={() => setIsAddingSection(!isAddingSection)}
                            >
                                {isAddingSection ? <X size={16} /> : <Plus size={16} />}
                            </button>
                            {isAddingSection && (
                                <div className="absolute left-0 top-full mt-2 w-56 bg-surface shadow-xl rounded-lg border border-line z-30 overflow-hidden">
                                    <div className="max-h-48 overflow-y-auto p-1">
                                        {availableSections.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent-dim rounded-md transition-colors text-txt-2"
                                                onClick={() => {
                                                    onCollaboratingSectionsChange([...collaboratingSections, s.name]);
                                                    setIsAddingSection(false);
                                                }}
                                            >
                                                {s.name}
                                            </button>
                                        ))}
                                        {availableSections.length === 0 && (
                                            <div className="px-3 py-4 text-xs text-txt-3 italic text-center">
                                                No hay más secciones disponibles
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <p className="text-[11px] text-txt-3 mt-1">
                    Estas secciones también verán y podrán gestionar el trabajo.
                </p>
            </div>

            {/* Colaboradores */}
            <div>
                <label className="block text-sm font-medium text-txt-2 mb-2 flex items-center gap-2">
                    <UserPlus size={16} /> Colaboradores
                </label>
                <div className="flex flex-wrap gap-2 items-center min-h-[42px] p-2 bg-surface-2 border border-line rounded-lg">
                    {collaborators.map(id => {
                        const u = users.find(x => x.id === id);
                        return u ? (
                            <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent-dim text-accent border border-accent-border">
                                {u.name.split(' ')[0]}
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => onCollaboratorsChange(collaborators.filter(c => c !== id))}
                                        className="hover:text-ko transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </span>
                        ) : null;
                    })}
                    {!disabled && (
                        <div className="relative">
                            <button
                                type="button"
                                className={`p-1.5 rounded-full transition-all ${isAddingCollaborator ? 'bg-accent text-white' : 'bg-surface text-accent border border-accent-border hover:bg-accent-dim'}`}
                                onClick={() => setIsAddingCollaborator(!isAddingCollaborator)}
                            >
                                {isAddingCollaborator ? <X size={16} /> : <Plus size={16} />}
                            </button>
                            {isAddingCollaborator && (
                                <div className="absolute left-0 top-full mt-2 w-56 bg-surface shadow-xl rounded-lg border border-line z-30 overflow-hidden">
                                    <div className="max-h-48 overflow-y-auto p-1">
                                        {availableUsers.map(u => (
                                            <button
                                                key={u.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent-dim rounded-md transition-colors text-txt-2"
                                                onClick={() => {
                                                    onCollaboratorsChange([...collaborators, u.id]);
                                                    setIsAddingCollaborator(false);
                                                }}
                                            >
                                                {u.name}
                                            </button>
                                        ))}
                                        {availableUsers.length === 0 && (
                                            <div className="px-3 py-4 text-xs text-txt-3 italic text-center">
                                                No hay usuarios disponibles
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <p className="text-[11px] text-txt-3 mt-1">
                    Usuarios que siguen el caso (ven su actividad).
                </p>
            </div>
        </>
    );
};
