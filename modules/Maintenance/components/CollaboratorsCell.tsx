import React, { useState } from 'react';
import { User, WorkOrder } from '../../../types';

interface CollaboratorsCellProps {
    wo: WorkOrder;
    users: User[];
}

export const CollaboratorsCell: React.FC<CollaboratorsCellProps> = ({ wo, users }) => {
    const [showCollaborators, setShowCollaborators] = useState(false);
    const assignedUser = users.find(u => u.id === wo.assignedUserId);
    const collaborators = wo.collaborators
        ?.map(id => users.find(u => u.id === id))
        .filter((u): u is User => !!u) || [];
    const collaboratorCount = collaborators.length;

    if (!assignedUser && collaboratorCount === 0) return <span className="text-txt-3 text-xs italic">Sin asignar</span>;

    return (
        <div className="flex items-center gap-1">
            {assignedUser && (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-surface-3 flex items-center justify-center text-xs font-bold text-txt-2 border border-white border-line shadow-sm" title={assignedUser.name}>
                        {assignedUser.avatar ? (
                            <img src={assignedUser.avatar} alt={assignedUser.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            assignedUser.name.charAt(0)
                        )}
                    </div>
                    <span className="text-sm text-txt-2 truncate max-w-[100px]">{assignedUser.name.split(' ')[0]}</span>
                </div>
            )}
            {collaboratorCount > 0 && (
                <div className="relative">
                    <span
                        className="flex items-center justify-center w-5 h-5 rounded-full bg-spec-dim border border-spec-border text-[9px] font-bold text-spec cursor-pointer hover:scale-110 transition-transform"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowCollaborators(!showCollaborators);
                        }}
                        title={`+ ${collaboratorCount} colaboradores`}
                    >
                        +{collaboratorCount}
                    </span>

                    {showCollaborators && (
                        <div
                            className="absolute bottom-full left-0 mb-2 w-48 bg-surface rounded-lg shadow-xl border border-line p-2 z-50 animate-in fade-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-[10px] font-bold text-txt-3 uppercase tracking-wider mb-1 px-1">Colaboradores</div>
                            <div className="space-y-1">
                                {collaborators.map(c => (
                                    <div key={c.id} className="flex items-center gap-2 p-1 rounded hover:bg-surface-2">
                                        <div className="w-4 h-4 rounded-full bg-spec-dim text-spec flex items-center justify-center text-[8px]">
                                            {c.name.charAt(0)}
                                        </div>
                                        <span className="text-xs text-txt-2 truncate">{c.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
