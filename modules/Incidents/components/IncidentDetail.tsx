import React, { useState, useRef } from 'react';
import { Incident, IncidentStatus, UserRole, WOPriority, Attachment } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import {
    X, AlertCircle, Clock, CheckCircle2, XCircle, FileText,
    Calendar, MapPin, Wrench, ChevronRight, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ConvertIncidentModal } from './ConvertIncidentModal';
import { CommentTimeline, SharedComment } from '../../../components/common/CommentTimeline';
import { CommentInput } from '../../../components/common/CommentInput';

interface IncidentDetailProps {
    incident: Incident | null;
    onClose: () => void;
    onNavigateToWorkOrder: (woId: string) => void;
}



export const IncidentDetail: React.FC<IncidentDetailProps> = ({ incident, onClose, onNavigateToWorkOrder }) => {
    const { currentUser, addIncidentComment, workOrders, transitionIncidentStatus, updateIncident, stoppages } = useAppStore();
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [viewMedia, setViewMedia] = useState<{ type: 'image' | 'video' | 'pdf' | 'file'; url: string; name: string } | null>(null);
    const [reasonText, setReasonText] = useState('');
    const [solutionText, setSolutionText] = useState('');
    const [isSavingTransition, setIsSavingTransition] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setReasonText(incident?.reason || '');
        setSolutionText(incident?.solution || '');
    }, [incident?.id, incident?.reason, incident?.solution]);

    if (!incident) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 dark:text-slate-500">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-6">
                    <FileText size={40} className="opacity-20" />
                </div>
                <h2 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Selecciona una incidencia</h2>
                <p className="text-center max-w-xs">Haz clic en una incidencia de la lista para ver sus detalles, comentarios y evolución.</p>
            </div>
        );
    }

    const handleSendComment = async (text: string, attachments: Attachment[]) => {
        try {
            await addIncidentComment({
                incidentId: incident.id,
                userId: currentUser?.id,
                userName: currentUser?.name || 'Usuario',
                text,
                isSystem: false,
                attachments
            });
            // Scroll to bottom
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
        } catch (error) {
            console.error(error);
        }
    };

    const isManagerOrAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SECTION_MANAGER;
    const linkedWO = incident.workOrderId ? workOrders.find(wo => wo.id === incident.workOrderId) : null;
    const canManageStatus = isManagerOrAdmin
        && incident.status !== IncidentStatus.RESOLVED
        && incident.status !== IncidentStatus.CANCELLED;
    const incidentStoppage = stoppages.find(st => st.incidentId === incident.id);
    const isDirty = reasonText !== (incident.reason || '')
        || solutionText !== (incident.solution || '');

    const handleTransition = async (status: IncidentStatus) => {
        if (isSavingTransition) return;
        setIsSavingTransition(true);
        try {
            await transitionIncidentStatus(incident.id, status, reasonText, solutionText);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingTransition(false);
        }
    };

    const handleSaveReasonSolution = async () => {
        if (isSavingTransition) return;
        setIsSavingTransition(true);
        try {
            await updateIncident(incident.id, {
                reason: reasonText.trim() || null,
                solution: solutionText.trim() || null
            });
            await addIncidentComment({
                incidentId: incident.id,
                userId: currentUser?.id,
                userName: 'Sistema',
                text: 'Motivo y solución actualizados',
                isSystem: true
            });
            toast.success('Motivo y solución actualizados');
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingTransition(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-700 transition-colors">
            {/* Detail Header */}
            <div className="flex-none p-4 md:p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex justify-between items-start mb-4">
                    <button
                        onClick={onClose}
                        className="md:hidden p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl transition-all active:scale-95 shadow-sm border border-slate-200 dark:border-slate-700"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex gap-2 ml-auto">
                        {isManagerOrAdmin && incident.status !== IncidentStatus.CONVERTED && incident.status !== IncidentStatus.RESOLVED && (
                            <button
                                onClick={() => setIsConvertModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                            >
                                <Wrench size={16} />
                                Gestionar a OT
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="hidden md:flex p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <StatusBadge status={incident.status} type="incident" className="text-sm px-3 py-1.5" />
                        {incident.categoryName && (
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-800/50">
                                {incident.categoryName}
                            </span>
                        )}
                        {incidentStoppage && (
                            <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${incidentStoppage.endAt
                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}
                                title={`Parada del equipo desde el ${new Date(incidentStoppage.startAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                            >
                                {incidentStoppage.endAt ? '⏸ Equipo parado' : '⏸ Equipo parado (en curso)'}
                            </span>
                        )}
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {incident.displayId || incident.id.split('-')[0]}
                        </span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                        {incident.title}
                    </h2>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className={incident.section ? "text-blue-500" : "text-amber-500"} />
                            {incident.section ? (
                                <span className="text-slate-600 dark:text-slate-300 font-medium">{incident.section}</span>
                            ) : (
                                <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs px-2 py-1 rounded-full font-bold">
                                    Sin Sección Asignada
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-4">
                            <Calendar size={16} className="text-amber-500" />
                            <span>{new Date(incident.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>
                        {incident.creatorName && (
                            <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-4">
                                <span className="text-xs font-bold text-slate-400 uppercase">Creado por:</span>
                                <span className="font-bold text-slate-600 dark:text-slate-300">{incident.creatorName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail Content (Scrollable) */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 custom-scrollbar bg-white dark:bg-slate-700"
            >
                {/* Description Section */}
                <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Descripción de la Incidencia</h3>
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                        {incident.description}
                    </div>
                </section>

                {/* Reason & Solution tracking */}
                <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Motivo y Solución</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Motivo</label>
                            {canManageStatus ? (
                                <textarea
                                    value={reasonText}
                                    onChange={(e) => setReasonText(e.target.value)}
                                    rows={2}
                                    placeholder="¿Por qué se ha producido la incidencia?"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            ) : (
                                <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm min-h-[44px]">
                                    {incident.reason || <span className="text-slate-400 italic">Sin motivo registrado</span>}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Solución</label>
                            {canManageStatus ? (
                                <textarea
                                    value={solutionText}
                                    onChange={(e) => setSolutionText(e.target.value)}
                                    rows={2}
                                    placeholder="¿Qué se ha hecho para resolverla?"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                />
                            ) : (
                                <div className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm min-h-[44px]">
                                    {incident.solution || <span className="text-slate-400 italic">Sin solución registrada</span>}
                                </div>
                            )}
                        </div>

                        {incident.status === IncidentStatus.RESOLVED && (incident.resolvedByName || incident.resolvedAt) && (
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={14} />
                                Resuelta
                                {incident.resolvedByName ? ` por ${incident.resolvedByName}` : ''}
                                {incident.resolvedAt ? ` el ${new Date(incident.resolvedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                            </div>
                        )}

                        {canManageStatus && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {isDirty && (
                                    <button
                                        onClick={handleSaveReasonSolution}
                                        disabled={isSavingTransition}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                                    >
                                        <Save size={16} />
                                        Guardar
                                    </button>
                                )}
                                {incident.status === IncidentStatus.OPEN && (
                                    <button
                                        onClick={() => handleTransition(IncidentStatus.IN_REVIEW)}
                                        disabled={isSavingTransition}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                                    >
                                        <Clock size={16} />
                                        Pasar a En Revisión
                                    </button>
                                )}
                                <button
                                    onClick={() => handleTransition(IncidentStatus.RESOLVED)}
                                    disabled={isSavingTransition}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                                >
                                    <CheckCircle2 size={16} />
                                    Marcar Resuelta
                                </button>
                                <button
                                    onClick={() => handleTransition(IncidentStatus.CANCELLED)}
                                    disabled={isSavingTransition}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-500 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                                >
                                    <XCircle size={16} />
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Linked Work Order Info */}
                {linkedWO && (
                    <button
                        onClick={() => onNavigateToWorkOrder(linkedWO.id)}
                        className="w-full text-left bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/50 rounded-2xl overflow-hidden animate-in fade-in duration-500 hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                    >
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-xl text-purple-600 dark:text-purple-400">
                                    <Wrench size={24} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">Orden de Trabajo vinculada</h4>
                                    <p className="text-xs text-purple-700 dark:text-purple-400">OT: {linkedWO.id} • {linkedWO.status}</p>
                                </div>
                            </div>
                            <ChevronRight className="text-purple-400" />
                        </div>
                    </button>
                )}

                {/* Attachments Section (Original report files) */}
                {incident.attachments && incident.attachments.length > 0 && (
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Archivos originales del reporte</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {incident.attachments.map((att, idx) => (
                                <div
                                    key={idx}
                                    className="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 group relative cursor-pointer"
                                    onClick={() => setViewMedia({ type: att.type as any, url: att.url, name: att.name })}
                                >
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileText size={32} className="text-slate-300" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Refactored Comments Section */}
                <CommentTimeline
                    comments={(incident.comments || []) as SharedComment[]}
                    currentUserId={currentUser?.id}
                    setViewMedia={setViewMedia}
                    maxHeight="none" // Already in a scrollable container
                />
            </div>

            {/* Refactored Comment Input */}
            <div className="flex-none p-4 md:p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <CommentInput
                    onSend={handleSendComment}
                    storageBucket="incident-files"
                    placeholder="Escribe un comentario o actualización..."
                />
            </div>

            {/* Modals */}
            {isConvertModalOpen && (
                <ConvertIncidentModal
                    isOpen={isConvertModalOpen}
                    onClose={() => setIsConvertModalOpen(false)}
                    incident={incident}
                />
            )}

            {/* Media Preview Modal */}
            {viewMedia && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-5xl h-full flex flex-col items-center justify-center">
                        <button
                            onClick={() => setViewMedia(null)}
                            className="absolute top-0 right-0 p-2 text-white/50 hover:text-white transition-colors"
                        >
                            <X size={32} />
                        </button>

                        {viewMedia.type === 'image' ? (
                            <img src={viewMedia.url} alt={viewMedia.name} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                        ) : viewMedia.type === 'pdf' ? (
                            <iframe src={viewMedia.url} className="w-full h-[85vh] rounded-lg bg-white" title={viewMedia.name} />
                        ) : (
                            <video src={viewMedia.url} controls className="max-w-full max-h-[85vh] rounded-lg" />
                        )}

                        <div className="mt-4 text-white font-medium">{viewMedia.name}</div>
                    </div>
                </div>
            )}
        </div>
    );
};
