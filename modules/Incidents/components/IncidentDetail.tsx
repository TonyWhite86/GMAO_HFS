import React, { useState, useRef } from 'react';
import { Incident, IncidentStatus, Attachment } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import {
    X, AlertCircle, Clock, CheckCircle2, XCircle, FileText,
    Calendar, MapPin, Wrench, ChevronRight, Save, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ConvertIncidentModal } from './ConvertIncidentModal';
import { CommentTimeline, SharedComment } from '../../../components/common/CommentTimeline';
import { CommentInput } from '../../../components/common/CommentInput';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { canConvertIncident, canManageIncident } from '../../../utils/incidentVisibility';

interface IncidentDetailProps {
    incident: Incident | null;
    onClose: () => void;
    onNavigateToWorkOrder: (woId: string) => void;
}



export const IncidentDetail: React.FC<IncidentDetailProps> = ({ incident, onClose, onNavigateToWorkOrder }) => {
    const { currentUser, addIncidentComment, workOrders, transitionIncidentStatus, confirmIncidentClose, updateIncident, stoppages, sections, incidentCategories } = useAppStore();
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [viewMedia, setViewMedia] = useState<{ type: 'image' | 'video' | 'pdf' | 'file'; url: string; name: string } | null>(null);
    const [isSavingTransition, setIsSavingTransition] = useState(false);
    const [targetStatus, setTargetStatus] = useState<string>('');
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [dateValue, setDateValue] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    if (!incident) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-txt-3">
                <div className="w-20 h-20 bg-surface-2 rounded-full flex items-center justify-center mb-6">
                    <FileText size={40} className="opacity-20" />
                </div>
                <h2 className="text-xl font-bold text-txt-2 mb-2">Selecciona una incidencia</h2>
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

    const isActive = (s?: IncidentStatus) => s !== undefined
        && s !== IncidentStatus.PENDING_CLOSE
        && s !== IncidentStatus.CLOSED;
    const linkedWO = incident.workOrderId ? workOrders.find(wo => wo.id === incident.workOrderId) : null;
    const canManageStatus = canManageIncident(incident, currentUser, incidentCategories, sections)
        && isActive(incident.status);
    const incidentStoppage = stoppages.find(st => st.incidentId === incident.id);

    // Admin: puede reabrir incidencias terminales y corregir la fecha de creación.
    const isAdmin = currentUser?.role === 'Admin';
    const canReopen = isAdmin && incident.status === IncidentStatus.CLOSED;

    // Convertir a OT: solo Admin o personal de sección comodín (Mantenimiento/Ingeniería),
    // y solo en estados activos.
    const canConvert = canConvertIncident(currentUser, sections) && isActive(incident.status);

    // Estados alcanzables desde el estado actual (para el selector).
    // El creador no propone cierre pendiente: para él "Cerrar incidencia" cierra
    // directo; la confirmación solo aplica a cierres ajenos.
    const isCreator = !!currentUser && incident.createdBy === currentUser.id;
    const reachableStatuses = (Object.values(IncidentStatus) as IncidentStatus[])
        .filter(s => s !== incident.status
            && (isActive(s)
                || (s === IncidentStatus.PENDING_CLOSE && isActive(incident.status) && !isCreator)));
    // Confirmación de cierre: sólo el creador (o Admin) sobre una propuesta pendiente.
    const canConfirmClose = incident.status === IncidentStatus.PENDING_CLOSE
        && (isAdmin || isCreator);

    const handleTransition = async (status: IncidentStatus) => {
        if (isSavingTransition) return;
        setIsSavingTransition(true);
        try {
            await transitionIncidentStatus(incident.id, status);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingTransition(false);
        }
    };

    const handleStatusChange = async () => {
        if (!targetStatus) return;
        await handleTransition(targetStatus as IncidentStatus);
        setTargetStatus('');
    };

    const handleConfirmClose = async () => {
        if (isSavingTransition) return;
        setIsSavingTransition(true);
        try {
            await confirmIncidentClose(incident.id, true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingTransition(false);
        }
    };

    const handleRejectClose = async () => {
        if (isSavingTransition || !rejectComment.trim()) return;
        setIsSavingTransition(true);
        try {
            await confirmIncidentClose(incident.id, false, rejectComment.trim());
            setIsRejecting(false);
            setRejectComment('');
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingTransition(false);
        }
    };

    const handleReopen = async () => {
        if (isSavingTransition) return;
        setIsSavingTransition(true);
        try {
            await transitionIncidentStatus(incident.id, IncidentStatus.OPEN);
            await addIncidentComment({
                incidentId: incident.id,
                userId: currentUser?.id,
                userName: 'Sistema',
                text: 'Incidencia reabierta por un administrador',
                isSystem: true
            });
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingTransition(false);
        }
    };

    const handleSaveDate = async () => {
        if (!dateValue || isSavingTransition) return;
        setIsSavingTransition(true);
        try {
            const newDate = new Date(dateValue).toISOString();
            await updateIncident(incident.id, { createdAt: newDate });
            await addIncidentComment({
                incidentId: incident.id,
                userId: currentUser?.id,
                userName: 'Sistema',
                text: `Fecha de la incidencia corregida: ${new Date(incident.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} → ${new Date(newDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
                isSystem: true
            });
            toast.success('Fecha actualizada');
            setIsEditingDate(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSavingTransition(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-surface transition-colors">
            {/* Detail Header */}
            <div className="flex-none p-4 md:p-6 border-b border-line bg-surface-2/50 bg-surface/30">
                <div className="flex justify-between items-start mb-4">
                    <button
                        onClick={onClose}
                        className="md:hidden p-2.5 bg-surface-2 text-txt-2 hover:text-txt-2 text-txt-3 rounded-xl transition-all active:scale-95 shadow-sm border border-line"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex flex-wrap gap-2 ml-auto">
                        {canConfirmClose && (
                            <>
                                <button
                                    onClick={handleConfirmClose}
                                    disabled={isSavingTransition}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 sm:py-2 btn btn-success rounded-xl font-bold text-sm transition-all active:scale-95"
                                >
                                    <CheckCircle2 size={16} />
                                    Confirmar cierre
                                </button>
                                <button
                                    onClick={() => setIsRejecting(true)}
                                    disabled={isSavingTransition}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 sm:py-2 btn btn-danger rounded-xl font-bold text-sm transition-all active:scale-95"
                                >
                                    <XCircle size={16} />
                                    No está resuelta
                                </button>
                            </>
                        )}
                        {canReopen && (
                            <button
                                onClick={handleReopen}
                                disabled={isSavingTransition}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 sm:py-2 btn btn-accent-ghost rounded-xl font-bold text-sm transition-all active:scale-95"
                            >
                                <AlertCircle size={16} />
                                Reabrir
                            </button>
                        )}
                        {canConvert && (
                            <button
                                onClick={() => setIsConvertModalOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 sm:py-2 btn btn-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-accent/20 transition-all active:scale-95"
                            >
                                <Wrench size={16} />
                                Gestionar a OT
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="hidden md:flex p-2 text-txt-3 hover:bg-surface-2 rounded-lg transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <StatusBadge status={incident.status} type="incident" className="text-sm px-3 py-1.5" />
                        {incident.categoryName && (
                            <span className="text-xs font-bold text-accent bg-accent-dim px-2.5 py-1 rounded-full border border-accent-border">
                                {incident.categoryName}
                            </span>
                        )}
                        {incidentStoppage && (
                            <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${incidentStoppage.endAt
                                    ? 'bg-surface-2 text-txt-2 bg-surface text-txt-2 border-line'
                                    : 'bg-warn-dim text-warn border-warn-border'}`}
                                title={`Parada del equipo desde el ${new Date(incidentStoppage.startAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                            >
                                {incidentStoppage.endAt ? '⏸ Equipo parado' : '⏸ Equipo parado (en curso)'}
                            </span>
                        )}
                        <span className="text-xs font-bold text-txt-2 bg-surface-2 px-2 py-0.5 rounded border border-line">
                            {incident.displayId || incident.id.split('-')[0]}
                        </span>
                    </div>

                    <h2 className="text-2xl font-black text-txt leading-tight">
                        {incident.title}
                    </h2>

                    <div className="flex flex-wrap gap-4 text-sm text-txt-2">
                        <div className="flex items-center gap-2">
                            <MapPin size={16} className={incident.section ? "text-accent" : "text-warn"} />
                            {incident.section ? (
                                <span className="text-txt-2 font-medium">{incident.section}</span>
                            ) : (
                                <span className="bg-warn-dim text-warn text-xs px-2 py-1 rounded-full font-bold">
                                    Sin Sección Asignada
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-line pl-4">
                            <Calendar size={16} className="text-warn" />
                            {isAdmin && isEditingDate ? (
                                <span className="flex items-center gap-1.5">
                                    <input
                                        type="datetime-local"
                                        value={dateValue}
                                        onChange={(e) => setDateValue(e.target.value)}
                                        className="fld-input px-2 py-1 rounded-md text-xs"
                                    />
                                    <button
                                        onClick={handleSaveDate}
                                        disabled={isSavingTransition || !dateValue}
                                        className="btn btn-primary btn-sm"
                                    >
                                        <Save size={12} />
                                    </button>
                                    <button
                                        onClick={() => setIsEditingDate(false)}
                                        className="btn btn-ghost btn-sm"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5">
                                    <span>{new Date(incident.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                    {isAdmin && (
                                        <button
                                            onClick={() => {
                                                const d = new Date(incident.createdAt);
                                                const pad = (n: number) => String(n).padStart(2, '0');
                                                setDateValue(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                                setIsEditingDate(true);
                                            }}
                                            title="Editar fecha"
                                            className="p-1 rounded transition-colors text-txt-3 hover:text-accent hover:bg-accent-dim"
                                        >
                                            <Calendar size={12} />
                                        </button>
                                    )}
                                </span>
                            )}
                        </div>
                        {incident.creatorName && (
                            <div className="flex items-center gap-1.5 border-l border-line pl-4">
                                <span className="text-xs font-bold text-txt-3 uppercase">Creado por:</span>
                                <span className="font-bold text-txt-2">{incident.creatorName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail Content (Scrollable) */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 custom-scrollbar bg-surface"
            >
                {/* Description Section */}
                <section>
                    <h3 className="text-xs font-bold text-txt-3 uppercase tracking-widest mb-3">Descripción de la Incidencia</h3>
                    <div className="bg-surface-2 p-4 rounded-2xl border border-line text-txt-2 leading-relaxed">
                        {incident.description}
                    </div>
                </section>

                {/* Rechazo del cierre (creador) */}
                {isRejecting && (
                    <section className="bg-ko-dim border border-ko-border rounded-2xl p-4 animate-fade-in">
                        <h3 className="text-xs font-bold text-ko uppercase tracking-widest mb-2">¿Por qué no está resuelta?</h3>
                        <p className="text-xs text-txt-2 mb-3">
                            La incidencia volverá a estar Abierta. Indica qué falta o qué no se ha solucionado.
                        </p>
                        <textarea
                            value={rejectComment}
                            onChange={(e) => setRejectComment(e.target.value)}
                            rows={3}
                            placeholder="Ej: el equipo sigue fallando después de la reparación…"
                            className="w-full px-4 py-2.5 rounded-xl border border-line bg-surface text-txt text-sm focus:ring-2 focus:ring-ko outline-none resize-none"
                        />
                        <div className="flex flex-wrap gap-2 mt-3">
                            <button
                                onClick={handleRejectClose}
                                disabled={isSavingTransition || !rejectComment.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-ko hover:bg-ko hover:brightness-110 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                            >
                                <XCircle size={16} />
                                Reabrir incidencia
                            </button>
                            <button
                                onClick={() => { setIsRejecting(false); setRejectComment(''); }}
                                className="flex items-center gap-2 px-4 py-2 bg-surface-3 hover:bg-surface-3 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                            >
                                Volver
                            </button>
                        </div>
                    </section>
                )}

                {/* Estado y cierre */}
                <section>
                    <h3 className="text-xs font-bold text-txt-3 uppercase tracking-widest mb-3">Estado</h3>
                    <div className="space-y-4">
                        {incident.status === IncidentStatus.CLOSED && (incident.resolvedByName || incident.resolvedAt) && (
                            <div className="flex items-center gap-2 text-xs font-medium text-ok">
                                <CheckCircle2 size={14} />
                                Cerrada
                                {incident.resolvedByName ? ` por ${incident.resolvedByName}` : ''}
                                {incident.resolvedAt ? ` el ${new Date(incident.resolvedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                            </div>
                        )}
                        {incident.status === IncidentStatus.PENDING_CLOSE && (
                            <div className="flex items-center gap-2 text-xs font-medium text-warn">
                                <Clock size={14} />
                                Cierre propuesto
                                {incident.resolvedByName ? ` por ${incident.resolvedByName}` : ''}
                                {incident.resolvedAt ? ` el ${new Date(incident.resolvedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''} — pendiente de confirmación del creador
                            </div>
                        )}

                        {canManageStatus && (
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="flex-1 min-w-[220px]">
                                    <label className="block text-xs font-bold text-txt-3 uppercase tracking-wider mb-1.5">Cambiar a</label>
                                    <CustomSelect
                                        value={targetStatus}
                                        onChange={setTargetStatus}
                                        options={reachableStatuses.map(s => ({ value: s, label: s }))}
                                        placeholder="Selecciona el nuevo estado…"
                                    />
                                </div>
                                <button
                                    onClick={handleStatusChange}
                                    disabled={isSavingTransition || !targetStatus}
                                    className="btn btn-primary px-4 py-2.5 disabled:opacity-50"
                                >
                                    <ArrowRight size={16} />
                                    Cambiar estado
                                </button>
                                <button
                                    onClick={() => handleTransition(IncidentStatus.CLOSED)}
                                    disabled={isSavingTransition}
                                    className="btn btn-success px-4 py-2.5"
                                >
                                    <CheckCircle2 size={16} />
                                    Cerrar incidencia
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                {/* Linked Work Order Info */}
                {linkedWO && (
                    <button
                        onClick={() => onNavigateToWorkOrder(linkedWO.id)}
                        className="w-full text-left bg-spec-dim border border-spec-border rounded-2xl overflow-hidden animate-in fade-in duration-500 hover:bg-spec-dim transition-colors cursor-pointer"
                    >
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-spec-dim rounded-xl text-spec">
                                    <Wrench size={24} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-spec">Orden de Trabajo vinculada</h4>
                                    <p className="text-xs text-spec">OT: {linkedWO.id} • {linkedWO.status}</p>
                                </div>
                            </div>
                            <ChevronRight className="text-spec" />
                        </div>
                    </button>
                )}

                {/* Attachments Section (Original report files) */}
                {incident.attachments && incident.attachments.length > 0 && (
                    <section>
                        <h3 className="text-xs font-bold text-txt-3 uppercase tracking-widest mb-3">Archivos originales del reporte</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {incident.attachments.map((att, idx) => (
                                <div
                                    key={idx}
                                    className="aspect-square rounded-xl border border-line overflow-hidden bg-surface-2 group relative cursor-pointer"
                                    onClick={() => setViewMedia({ type: att.type as any, url: att.url, name: att.name })}
                                >
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <FileText size={32} className="text-txt-3" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Refactored Comments Section */}
                <CommentTimeline
                    comments={[
                        ...(incident.comments || []),
                        // El timeline se pinta al revés (más reciente arriba): la
                        // creación va la última del array para quedar visible arriba.
                        {
                            id: 'created',
                            userId: '',
                            userName: incident.creatorName || 'Sistema',
                            text: `Incidencia creada${incident.creatorName ? ` por ${incident.creatorName}` : ''}`,
                            createdAt: incident.createdAt,
                            isSystem: true
                        }
                    ] as SharedComment[]}
                    currentUserId={currentUser?.id}
                    setViewMedia={setViewMedia}
                    maxHeight="none" // Already in a scrollable container
                />
            </div>

            {/* Refactored Comment Input */}
            <div className="flex-none p-4 md:p-6 border-t border-line bg-surface-2/50 bg-surface/20">
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
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
                            <iframe src={viewMedia.url} className="w-full h-[85vh] rounded-lg bg-surface" title={viewMedia.name} />
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
