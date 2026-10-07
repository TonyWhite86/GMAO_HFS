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
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p className="font-medium">No se encontraron incidencias</p>
                <p className="text-sm">Prueba a ajustar los filtros o el término de búsqueda.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-700 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Desktop List Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="col-span-2">ID</div>
                <div className="col-span-4">Título / Descripción</div>
                <div className="col-span-2">Sección</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2 text-right">Fecha</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {incidents.map((incident) => (
                    <button
                        key={incident.id}
                        onClick={() => onSelect(incident.id)}
                        className={`w-full text-left transition-colors group ${selectedId === incident.id
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-900/50'
                            }`}
                    >
                        {/* Desktop Row */}
                        <div className="hidden md:grid grid-cols-12 gap-4 p-4 items-center">
                            <div className="col-span-2">
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                        {incident.displayId || incident.id.split('-')[0]}
                                    </span>
                                    {incident.categoryName && (
                                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                            {incident.categoryName}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="col-span-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">
                                        {incident.title}
                                    </span>
                                    <span className="text-xs text-slate-500 line-clamp-1">
                                        {incident.creatorName ? (
                                            <span className="font-bold text-slate-400 mr-2 uppercase tracking-tighter">[{incident.creatorName}]</span>
                                        ) : null}
                                        {incident.description}
                                    </span>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                    {incident.section ? (
                                        <>
                                            <MapPin size={12} className="text-blue-500" />
                                            {incident.section}
                                        </>
                                    ) : (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">
                                            Sin Sección
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <StatusBadge status={incident.status} type="incident" />
                            </div>
                            <div className="col-span-2 text-right">
                                <span className="text-[11px] text-slate-400">
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
                                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                                            {incident.categoryName}
                                        </span>
                                    )}
                                </div>
                                <StatusBadge status={incident.status} type="incident" />
                            </div>

                            <h3 className="font-bold text-slate-800 dark:text-white mb-1 line-clamp-1">
                                {incident.title}
                            </h3>

                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                                {incident.creatorName && (
                                    <span className="font-bold text-slate-400 mr-1 uppercase">[{incident.creatorName}]</span>
                                )}
                                {incident.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 border-t border-slate-100 dark:border-slate-700 pt-3 mt-auto">
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <MapPin size={14} className="text-slate-400" />
                                    <span>{incident.section}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-auto">
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
