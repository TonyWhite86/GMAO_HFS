import React from 'react';
import { Incident, IncidentStatus, WOPriority } from '../../../types';
import { ChevronRight, MapPin, Tag, AlertCircle } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { PRIORITY_CONFIG } from '../../../constants';

interface IncidentListProps {
    incidents: Incident[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}



export const IncidentList: React.FC<IncidentListProps> = ({ incidents, selectedId, onSelect }) => {
    if (incidents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-txt-3 bg-surface rounded-2xl border border-dashed border-line">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="font-medium">No se encontraron incidencias</p>
                <p className="text-sm">Prueba a ajustar los filtros o el término de búsqueda.</p>
            </div>
        );
    }

    return (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
            {/* Desktop List Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-line bg-surface-2/50 bg-surface/30 text-[10px] font-bold text-txt-3 uppercase tracking-widest">
                <div className="col-span-2">ID</div>
                <div className="col-span-4">Título / Descripción</div>
                <div className="col-span-2">Sección</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2 text-right">Fecha</div>
            </div>

            <div className="divide-y divide-line">
                {incidents.map((incident) => (
                    <button
                        key={incident.id}
                        onClick={() => onSelect(incident.id)}
                        className={`w-full text-left transition-colors group ${selectedId === incident.id
                            ? 'bg-accent-dim'
                            : 'hover:bg-surface-2 '
                            }`}
                    >
                        {/* Desktop Row */}
                        <div className="hidden md:grid grid-cols-12 gap-4 p-4 items-center">
                            <div className="col-span-2">
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-xs font-bold text-txt-2 bg-surface-2 px-2 py-0.5 rounded border border-line whitespace-nowrap">
                                        {incident.displayId || incident.id.split('-')[0]}
                                    </span>
                                    {incident.categoryName && (
                                        <span className="text-[10px] font-bold text-accent bg-accent-dim px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                            {incident.categoryName}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="col-span-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-txt group-hover:text-accent transition-colors">
                                        {incident.title}
                                    </span>
                                    <span className="text-xs text-txt-2 line-clamp-1">
                                        {incident.creatorName ? (
                                            <span className="font-bold text-txt-3 mr-2 uppercase tracking-tighter">[{incident.creatorName}]</span>
                                        ) : null}
                                        {incident.description}
                                    </span>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="flex items-center gap-1.5 text-xs text-txt-2">
                                    {incident.section ? (
                                        <>
                                            <MapPin size={12} className="text-accent" />
                                            {incident.section}
                                        </>
                                    ) : (
                                        <span className="text-[10px] bg-warn-dim text-warn px-1.5 py-0.5 rounded font-bold">
                                            Sin Sección
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <StatusBadge status={incident.status} type="incident" />
                            </div>
                            <div className="col-span-2 text-right">
                                <span className="text-[11px] text-txt-3">
                                    {new Date(incident.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            </div>
                        </div>

                        {/* Mobile Card */}
                        <div className="md:hidden p-4">
                            <div className="flex justify-between items-start gap-3 mb-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${PRIORITY_CONFIG[incident.priority]?.bgClass}`}>
                                        {incident.priority}
                                    </span>
                                    {incident.categoryName && (
                                        <span className="text-[10px] font-bold text-accent bg-accent-dim px-1.5 py-0.5 rounded-full">
                                            {incident.categoryName}
                                        </span>
                                    )}
                                </div>
                                <StatusBadge status={incident.status} type="incident" />
                            </div>

                            <h3 className="font-bold text-txt mb-1 line-clamp-1">
                                {incident.title}
                            </h3>

                            <p className="text-sm text-txt-2 line-clamp-2 mb-4 leading-relaxed">
                                {incident.creatorName && (
                                    <span className="font-bold text-txt-3 mr-1 uppercase">[{incident.creatorName}]</span>
                                )}
                                {incident.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 border-t border-line pt-3 mt-auto">
                                <div className="flex items-center gap-1.5 text-xs text-txt-2">
                                    <MapPin size={14} className="text-txt-3" />
                                    <span>{incident.section}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-txt-2 ml-auto">
                                    <span>{new Date(incident.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(incident.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
