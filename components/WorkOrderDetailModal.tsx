import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trash2, Edit2, PlayCircle, PauseCircle, Plus, X, Search, QrCode, Mic, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Package, CheckSquare, Paperclip, ZoomIn, FileText, User as UserIcon, MessageSquare, Send, Save, Eye, Check, Clock, AlertTriangle, Calendar, Users as UsersIcon, ListTodo, UserPlus } from 'lucide-react';
import { StatusBadge } from './common/StatusBadge';
import { PriorityIndicator } from './common/PriorityIndicator';
import { normalizeForSearch } from '../utils/searchUtils';
import { QRScannerModal } from './QRScannerModal';
import { CustomSelect } from './ui/CustomSelect';
import { EquipmentSelector } from './EquipmentSelector';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { compressImage } from '../utils/compressImage';
import { QuickStatusModal } from './workOrder/QuickStatusModal';
import { VoiceInputButton } from './ui/VoiceInputButton';
import { LiveTimer } from './LiveTimer';
import { computeActiveMinutes, hasActiveSession } from '../utils/timeTracking';

const SLOW_SPIN_CSS = `
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin-slow {
  animation: spin-slow 8s linear infinite;
}
`;

const toDatetimeLocalValue = (isoString: string): string => {
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

import { WorkOrder, WOStatus, WOPriority, WOType, User, Equipment, Comment, Attachment, PreventivePlan, UserRole, InventoryItem, SubTask, Section } from '../types';

// Import sub-components
import { WOPartsList } from './workOrder/WOPartsList';
import { WOSubtasksList } from './workOrder/WOSubtasksList';
import { WOAttachmentsGrid } from './workOrder/WOAttachmentsGrid';
import { WOCommentsSection } from './workOrder/WOCommentsSection';
import { QuickCompleteModal } from './workOrder/QuickCompleteModal';

interface DetailModalProps {
    workOrder: WorkOrder;
    onClose: () => void;
    onUpdate: (updatedWO: WorkOrder, shouldClose?: boolean) => void;
    onAddWorkOrder: (wo: WorkOrder) => void; // For recursive creation
    preventivePlans: PreventivePlan[];
    currentUser: User;
    users: User[];
    equipment: Equipment[];
    existingWorkOrders: WorkOrder[];
    sections: Section[];
    inventory: InventoryItem[];
    onUpdateInventory: (item: InventoryItem) => void;
}



export const WorkOrderDetailModal: React.FC<DetailModalProps> = ({
    workOrder, onClose, onUpdate, onAddWorkOrder, preventivePlans, currentUser, users, equipment, existingWorkOrders, sections, inventory, onUpdateInventory
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedWO, setEditedWO] = useState<WorkOrder>(workOrder);

    // True when actively working (IN_PROGRESS with an open session). A paused WO is
    // IN_PROGRESS but with a closed session, so the header offers "Reanudar" instead.
    const isRunning = editedWO.status === WOStatus.IN_PROGRESS && hasActiveSession(editedWO.statusHistory);

    // Logic for overdue tasks
    const isOverdue = useMemo(() => {
        if (editedWO.status === WOStatus.COMPLETED) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const scheduledDate = editedWO.scheduledDate ? new Date(editedWO.scheduledDate) : new Date(editedWO.createdAt);
        scheduledDate.setHours(0, 0, 0, 0);
        return scheduledDate < today;
    }, [editedWO.status, editedWO.scheduledDate, editedWO.createdAt]);

    // State for media viewing
    const [viewMedia, setViewMedia] = useState<{ type: 'image' | 'video' | 'pdf' | 'file'; url: string; name: string } | null>(null);
    // UI State
    const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
    const [isAddingCollaboratingSection, setIsAddingCollaboratingSection] = useState(false);
    const [showValidationErrors, setShowValidationErrors] = useState(false);

    const [statusUpdateMode, setStatusUpdateMode] = useState<WOStatus | null>(null);
    const [isCompleting, setIsCompleting] = useState(false);
    const [pendingReasonInput, setPendingReasonInput] = useState('');
    const [finalHours, setFinalHours] = useState<number>(0);
    const [finalMinutes, setFinalMinutes] = useState<number>(0);
    const [statusActionWO, setStatusActionWO] = useState<{ wo: WorkOrder; nextStatus: WOStatus } | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [completionNotes, setCompletionNotes] = useState('');
    const [activeTab, setActiveTab] = useState<'detalle' | 'tareas' | 'piezas' | 'adjuntos' | 'actividad'>('detalle');

    // Track newly uploaded files in this session for cleanup on cancel
    const newlyUploadedFilesRef = useRef<string[]>([]);

    // Calculate Available Sections
    const availableSections = useMemo(() => {
        if (currentUser.role === UserRole.ADMIN) return sections.map(s => s.name);
        return currentUser.sections;
    }, [currentUser, sections]);

    // Sync editedWO when workOrder prop changes
    useEffect(() => {
        setEditedWO({
            ...workOrder,
            subtasks: workOrder.subtasks || [],
            collaborators: workOrder.collaborators || [],
            collaboratingSections: workOrder.collaboratingSections || []
        });
        // Reset editing mode only if it's a completely different work order or initial open
        // (Optional: we might want to keep isEditing true if the user was editing while a system update happened)
        setIsEditing(false);
    }, [workOrder.id]); // Only reset editing on ID change? 
    // Actually, if we use workOrder, any change (like a comment) will reset isEditing to false.
    // Let's use workOrder.id to reset isEditing, but update editedWO on any workOrder change.
    // Let's use workOrder.id to reset isEditing, but update editedWO on any workOrder change.
    useEffect(() => {
        setEditedWO(prev => {
            // If we are editing, we want to preserve our local changes (title, priority, attachments, etc.)
            // but we DO want to receive new comments or history updates from the server/store.
            if (isEditing) {
                return {
                    ...prev,
                    comments: workOrder.comments, // Always sync comments
                    statusHistory: workOrder.statusHistory, // Always sync history
                    // If workOrder status changed externally (unlikely if locked, but good practice),
                    // we might want to warn or sync it. For now let's sync status too if we aren't editing it?
                    // But we are editing the WO object.
                    // Let's assume title/desc/attachments/etc are "owned" by the editor.
                    // But comments are "live".
                };
            }
            // If not editing, fully sync.
            return workOrder;
        });
    }, [workOrder, isEditing]);

    // Quick Status Update (Immediate Save with Comment)
    const handleQuickStatusUpdate = (newStatus: WOStatus) => {
        const timestamp = new Date().toISOString();
        const historyEntry = { status: newStatus, timestamp };
        const newHistory = [...(editedWO.statusHistory || []), historyEntry];

        // Calculate new total time immediately to store precise snapshot
        const totalMins = computeActiveMinutes(newStatus, newHistory, editedWO.timeSpentMinutes);

        // Generate System Comment
        const commentText = `Estado cambiado a: ${newStatus} (Acción Rápida).`;
        const sysComment: Comment = {
            id: `c-stat-${Date.now()}`,
            userId: 'system',
            userName: currentUser.name || 'Sistema',
            text: commentText,
            createdAt: timestamp,
            isSystem: true,
            status: newStatus
        };

        const updatedWO: WorkOrder = {
            ...editedWO,
            status: newStatus,
            statusHistory: newHistory,
            timeSpentMinutes: totalMins,
            comments: [...(editedWO.comments || []), sysComment],
            scheduledDate: editedWO.scheduledDate
        };

        // If resuming, clear pending reason
        if (newStatus === WOStatus.IN_PROGRESS && updatedWO.pendingReason) {
            updatedWO.pendingReason = undefined;
        }

        // Persist immediately
        onUpdate(updatedWO, false);
        setEditedWO(updatedWO);

        // Persist comment to DB
        useAppStore.getState().addComment(sysComment, editedWO.id);
    };

    const handleStatusChange = async (newStatus: WOStatus, pendingReason?: string, spentHours?: number, spentMinutes?: number, autoSave = false) => {
        let updated = { ...editedWO, status: newStatus };

        // --- HISTORY TRACKING ---
        const historyEntry = { status: newStatus, timestamp: new Date().toISOString() };
        const newHistory = [...(updated.statusHistory || []), historyEntry];
        updated.statusHistory = newHistory;
        // ------------------------

        if (newStatus === WOStatus.PENDING) {
            updated.pendingReason = pendingReason;
        } else {
            updated.pendingReason = undefined;
        }

        // FIX: Preserve Scheduled Date for IN_PROGRESS and COMPLETED
        if (newStatus === WOStatus.PENDING) {
            updated.scheduledDate = undefined;
        } else if (newStatus === WOStatus.SCHEDULED && !updated.scheduledDate) {
            updated.scheduledDate = new Date(Date.now() + 86400000).toISOString();
        }

        // Auto-calculate time if completing and no time set
        if (newStatus === WOStatus.COMPLETED) {
            const totalMins = (spentHours !== undefined && spentMinutes !== undefined)
                ? (spentHours * 60 + spentMinutes)
                : computeActiveMinutes(newStatus, newHistory, updated.timeSpentMinutes);
            updated.timeSpentMinutes = totalMins;
            updated.closedAt = new Date().toISOString();
        }

        // Generate System Comment
        const commentText = `Estado cambiado a: ${newStatus}${pendingReason ? `. ${newStatus === WOStatus.PENDING ? 'Motivo' : 'Notas'}: ${pendingReason}` : ''}${spentHours !== undefined ? `. Tiempo informado: ${spentHours}h ${spentMinutes}m` : ''}`;
        const sysComment: Comment = {
            id: `c-stat-${Date.now()}`,
            userId: 'system',
            userName: currentUser.name || 'Sistema',
            text: commentText,
            createdAt: historyEntry.timestamp,
            isSystem: true,
            status: newStatus
        };

        if (autoSave) {
            // La BD es la única dueña de status_history / time_spent_minutes /
            // closed_at. La transición se hace PRIMERO y se espera: si mandamos
            // el update de metadatos antes, la RPC ve la OT ya 'Completada',
            // aborta con "La orden ya está completada" y el tiempo se pierde.
            if (newStatus !== workOrder.status) {
                const action = newStatus === WOStatus.COMPLETED ? 'complete'
                    : newStatus === WOStatus.IN_PROGRESS
                        ? (workOrder.status === WOStatus.IN_PROGRESS ? 'resume' : 'start')
                        : 'pause';
                try {
                    const manualMins = (spentHours ?? 0) * 60 + (spentMinutes ?? 0);
                    await useAppStore.getState().transitionWorkOrder(
                        editedWO.id,
                        action as 'start' | 'pause' | 'resume' | 'complete',
                        pendingReason ?? null,
                        // Solo se pasa tiempo manual si el usuario indicó algo > 0.
                        // Con 0 dejamos que la RPC lo calcule del historial (y aplique
                        // el blindaje de no pisar un tiempo ya guardado).
                        action === 'complete' && manualMins > 0 ? manualMins : null
                    );
                } catch (err) {
                    console.error('Error transicionando la OT:', err);
                    return;
                }
            }
            updated.comments = [...(updated.comments || []), sysComment];
            setEditedWO(updated);
            onUpdate(updated, false);
        } else {
            // If just editing, update local state only
            setEditedWO(updated);
        }
    };

    const handleQuickComplete = () => {
        // Add COMPLETED to history
        const historyEntry = { status: WOStatus.COMPLETED, timestamp: new Date().toISOString() };
        const newHistory = [...(editedWO.statusHistory || []), historyEntry];
        const totalMins = computeActiveMinutes(WOStatus.COMPLETED, newHistory, editedWO.timeSpentMinutes);

        const updated = {
            ...editedWO,
            status: WOStatus.COMPLETED,
            closedAt: new Date().toISOString(),
            timeSpentMinutes: totalMins,
            statusHistory: newHistory
        };
        setEditedWO(updated);
        setIsEditing(true);
    };

    const handleSave = async () => {
        // Validation
        if (!editedWO.title.trim() || !editedWO.equipmentId || !editedWO.section) {
            setShowValidationErrors(true);
            toast.error('Por favor, rellene todos los campos obligatorios (*)');
            return;
        }

        let finalWO = { ...editedWO };
        let sysComments: Comment[] = [];

        // Detect Status Change
        if (finalWO.status !== workOrder.status) {
            let commentText = `Estado cambiado a: ${finalWO.status}.`;

            if (finalWO.status === WOStatus.PENDING && finalWO.pendingReason) {
                commentText += ` Motivo: ${finalWO.pendingReason}`;
            }

            const sysComment: Comment = {
                id: `c-stat-${Date.now()}`,
                userId: 'system',
                userName: 'Sistema',
                text: commentText,
                createdAt: new Date().toISOString(),
                isSystem: true,
                status: finalWO.status
            };
            sysComments.push(sysComment);
        }

        // Detect Priority Change
        if (finalWO.priority !== workOrder.priority) {
            const sysComment: Comment = {
                id: `c-prio-${Date.now()}`,
                userId: 'system',
                userName: 'Sistema',
                text: `Prioridad cambiada de ${workOrder.priority} a ${finalWO.priority}.`,
                createdAt: new Date().toISOString(),
                isSystem: true
            };
            sysComments.push(sysComment);
        }
        if (sysComments.length > 0) {
            // Local update for immediate feedback
            finalWO.comments = [...(finalWO.comments || []), ...sysComments];

            // Persist each system comment to DB
            sysComments.forEach(sc => {
                useAppStore.getState().addComment(sc, editedWO.id);
            });
        }

        // Si el estado cambia, la transición la valida y sella la BD
        if (finalWO.status !== workOrder.status) {
            const action = finalWO.status === WOStatus.COMPLETED ? 'complete'
                : finalWO.status === WOStatus.IN_PROGRESS
                    ? (workOrder.status === WOStatus.IN_PROGRESS ? 'resume' : 'start')
                    : 'pause';
            try {
                const manualMins = finalWO.timeSpentMinutes ?? 0;
                await useAppStore.getState().transitionWorkOrder(
                    editedWO.id,
                    action as 'start' | 'pause' | 'resume' | 'complete',
                    finalWO.pendingReason ?? null,
                    // El tiempo indicado a mano se pasa como manualMinutes: sin
                    // él la RPC lo recalcula desde el historial y deja 0 en una
                    // OT que nunca se "inició".
                    action === 'complete' && manualMins > 0 ? manualMins : null
                );
            } catch (err) {
                console.error('Error transicionando la OT:', err);
                return;
            }
        }

        onUpdate(finalWO, true);
        setIsEditing(false);
    };

    const handleSendComment = async (text: string, attachments?: Attachment[]) => {
        const newCommentObj: Comment = {
            id: `c-${Date.now()}`,
            userId: currentUser.id,
            userName: currentUser.name,
            text,
            createdAt: new Date().toISOString(),
            attachments: attachments || []
        };

        try {
            // Call store action to persist
            await useAppStore.getState().addComment(newCommentObj, editedWO.id);
            // Update local state is handled by store subscription usually, but here we can just wait.
            // Actually store updates state.workOrders. 
            // We need to update editedWO to reflect that change immediately if we want to see it without close/reopen.
            // The store update will propagate to 'workOrder' prop, and our useEffect(..., [workOrder]) will update editedWO?
            // Yes, line 191: useEffect(() => setEditedWO(workOrder), [workOrder]).
            // But we should verify if useAppStore hook is triggered.
            // Since this is a modal, it receives 'workOrder' from parent. Parent MUST listen to store.
            // Assuming parent does, we are good.
        } catch (error) {
            console.error(error);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsUploading(true);
            try {
                const newAttachments: Attachment[] = [];
                for (let i = 0; i < e.target.files.length; i++) {
                    const file = e.target.files[i];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                    const filePath = `${fileName}`;

                    // Compress image before upload
                    const compressedFile = file.type.startsWith('image/') ? await compressImage(file) : file;

                    const { error: uploadError } = await supabase.storage
                        .from('work-order-files')
                        .upload(filePath, compressedFile);

                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage
                        .from('work-order-files')
                        .getPublicUrl(filePath);

                    newAttachments.push({
                        id: crypto.randomUUID(),
                        name: file.name,
                        url: data.publicUrl,
                        type: file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : (file.type === 'application/pdf' ? 'pdf' : 'file'))
                    });

                    // Track this new file path for potential cleanup
                    newlyUploadedFilesRef.current.push(filePath);
                }

                setEditedWO(prev => ({
                    ...prev,
                    attachments: [...(prev.attachments || []), ...newAttachments]
                }));
                toast.success('Archivos subidos');
            } catch (error) {
                console.error(error);
                toast.error('Error al subir archivos');
            } finally {
                setIsUploading(false);
            }
        }
    };

    const removeFile = async (index: number) => {
        const attachmentToRemove = (editedWO.attachments || [])[index];
        if (!attachmentToRemove) return;

        const isExisting = workOrder.attachments?.some(a => a.url === attachmentToRemove.url);

        if (!isExisting) {
            try {
                const fileName = attachmentToRemove.url.split('/').pop();
                if (fileName) {
                    await supabase.storage.from('work-order-files').remove([fileName]);
                    // Remove from tracking ref logic
                    newlyUploadedFilesRef.current = newlyUploadedFilesRef.current.filter(p => !p.endsWith(fileName));
                }
            } catch (err) {
                console.error('Error removing file from storage:', err);
            }
        }

        setEditedWO(prev => ({
            ...prev,
            attachments: (prev.attachments || []).filter((_, i) => i !== index)
        }));
    };

    const handleClose = async () => {
        // Cleanup newly uploaded files if cancelling edit
        if (isEditing && newlyUploadedFilesRef.current.length > 0) {
            // We extract filenames from full paths if needed, or if ref stores relative paths. 
            // In handleFileChange we pushed `filePath` which is `fileName`.
            // So we can pass them directly to remove.
            try {
                // supabase remove takes an ARRAY of filenames (paths relative to bucket root? No, usually just names if in root, or paths).
                // The upload was to `work-orders/${fileName}`. So we probably stored that.
                // Let's check handleFileChange again. filePath = `work-orders/${fileName}`.
                // So newlyUploadedFilesRef contains `work-orders/timestamp_...`.
                // supabase .remove expects array of paths.
                if (newlyUploadedFilesRef.current.length > 0) {
                    await supabase.storage.from('work-order-files').remove(newlyUploadedFilesRef.current);
                }
            } catch (err) {
                console.error("Error cleaning up orphaned files", err);
            }
        }

        // Clear ref
        newlyUploadedFilesRef.current = [];
        onClose();
    };

    const tabs: { id: 'detalle' | 'tareas' | 'piezas' | 'adjuntos' | 'actividad'; label: string; icon: typeof FileText; count: number }[] = [
        { id: 'detalle', label: 'Detalle', icon: FileText, count: 0 },
        { id: 'tareas', label: 'Tareas', icon: ListTodo, count: editedWO.subtasks?.length || 0 },
        { id: 'piezas', label: 'Piezas', icon: Package, count: editedWO.usedParts?.length || 0 },
        { id: 'adjuntos', label: 'Adjuntos', icon: Paperclip, count: editedWO.attachments?.length || 0 },
        { id: 'actividad', label: 'Actividad', icon: MessageSquare, count: editedWO.comments?.length || 0 },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <style>{SLOW_SPIN_CSS}</style>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[98dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="relative p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">

                    {/* Absolute Close Button - Always Top Right */}
                    {/* Absolute Close Button - Always Top Right */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex-1 w-full pr-12">
                        <div className="flex flex-col items-start min-[500px]:flex-row min-[500px]:items-center gap-1 min-[500px]:gap-2">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
                                {isEditing ? 'Editar Orden de Trabajo' : 'Detalle de Orden de Trabajo'}
                            </h2>
                            {isOverdue && (
                                <span className="text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900/30 animate-pulse whitespace-nowrap">
                                    <AlertTriangle size={12} />
                                    Retrasado
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {isEditing ? 'Modifique los campos para actualizar la incidencia' : 'Consulte el historial y detalles del mantenimiento'}
                        </p>
                        {!isEditing && (
                            <div className="flex items-center justify-start gap-3 mt-3 w-full">
                                <StatusBadge status={editedWO.status} type="workOrder" />
                                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    {editedWO.id}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 sm:self-center">
                        {!isEditing && !statusUpdateMode && (
                            <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 sm:mr-12">
                                {(editedWO.status === WOStatus.PENDING || editedWO.status === WOStatus.SCHEDULED) && (
                                    <button
                                        onClick={() => setStatusActionWO({ wo: editedWO, nextStatus: WOStatus.IN_PROGRESS })}
                                        className="flex-1 sm:flex-none w-full sm:w-36 flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-bold text-xs shadow-lg shadow-blue-600/20 active:scale-95"
                                    >
                                        <PlayCircle size={14} className="shrink-0" /> <span>Iniciar</span>
                                    </button>
                                )}
                                {editedWO.status === WOStatus.IN_PROGRESS && (
                                    <button
                                        onClick={() => setStatusActionWO({ wo: editedWO, nextStatus: isRunning ? WOStatus.PENDING : WOStatus.IN_PROGRESS })}
                                        className={`flex-1 sm:flex-none w-full sm:w-36 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 text-white rounded-lg hover:bg-amber-600 transition-all font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 ${isRunning ? 'bg-amber-500' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
                                    >
                                        {isRunning ? (
                                            <><PauseCircle size={14} className="shrink-0" /> <span>Pausar</span></>
                                        ) : (
                                            <><PlayCircle size={14} className="shrink-0" /> <span>Reanudar</span></>
                                        )}
                                    </button>
                                )}
                                {editedWO.status !== WOStatus.COMPLETED && (
                                    <button
                                        onClick={() => setIsCompleting(true)}
                                        className="flex-1 sm:flex-none w-full sm:w-36 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-bold text-xs shadow-lg shadow-green-600/20 active:scale-95"
                                    >
                                        <CheckSquare size={14} className="shrink-0" /> <span>Finalizar</span>
                                    </button>
                                )}
                                <div className="hidden"></div>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex-1 sm:flex-none w-full sm:w-36 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 text-slate-600 dark:text-slate-300 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 hover:border-blue-500/20 active:scale-95 text-xs font-bold"
                                    title="Editar Orden"
                                >
                                    <Edit2 size={14} className="shrink-0" />
                                    <span>Editar</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Bar */}
                <div className="flex items-center gap-1 px-3 sm:px-5 pt-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 overflow-x-auto">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isTabActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                                    isTabActive
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                <Icon size={16} />
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${isTabActive ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">

                    {activeTab === 'detalle' && (
                    <>

                    {/* Status Update Prompt (Finalize) - Pause moved to QuickStatusModal */}
                    {statusUpdateMode === WOStatus.COMPLETED && (
                        <div className="p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl animate-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                                    <Clock size={18} />
                                    Resumen del Trabajo
                                </h3>
                                <button onClick={() => setStatusUpdateMode(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Indique el tiempo total invertido en esta orden:</p>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Horas</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-center"
                                            value={finalHours || 0}
                                            onChange={(e) => setFinalHours(Math.max(0, parseInt(e.target.value) || 0))}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Minutos</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-center"
                                            value={finalMinutes || 0}
                                            onChange={(e) => setFinalMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                                        />
                                    </div>
                                </div>

                                {/* Notes / Observations for completion */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Notas / Observaciones</label>
                                        <VoiceInputButton
                                            onTranscript={(text) => setCompletionNotes(prev => prev ? prev + ' ' + text : text)}
                                        />
                                    </div>
                                    <textarea
                                        className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
                                        placeholder="Detalles adicionales sobre el trabajo realizado..."
                                        value={completionNotes}
                                        onChange={(e) => setCompletionNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={async () => {
                                        // Se espera a que la transición termine antes de
                                        // cerrar el panel: si se cierra al instante se pierde
                                        // el feedback y el estado local queda a medias.
                                        await handleStatusChange(WOStatus.COMPLETED, completionNotes, finalHours, finalMinutes, true);
                                        setStatusUpdateMode(null);
                                        setCompletionNotes('');
                                    }}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md"
                                >
                                    Confirmar Finalización
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Title - Full Width */}
                        {isEditing && (
                            <div className="col-span-1 md:col-span-2">
                                <label htmlFor="wo-title" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Título *</label>
                                <input
                                    id="wo-title"
                                    name="title"
                                    className="w-full p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-500"
                                    placeholder="Ej. Ruido en motor principal"
                                    value={editedWO.title}
                                    onChange={(e) => setEditedWO({ ...editedWO, title: e.target.value })}
                                />
                            </div>
                        )}

                        {/* View Mode: Title & Basic Info summary */}
                        {!isEditing && (
                            <div className="col-span-1 md:col-span-2">
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">{editedWO.title}</h3>
                                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-[11px] sm:text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar size={14} className="opacity-70" /> Creada: {new Date(editedWO.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                    {editedWO.closedAt && <span className="flex items-center gap-1.5 text-green-600 font-bold whitespace-nowrap"><Check size={14} /> Finalizada: {new Date(editedWO.closedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                                    <span className={`flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-lg transition-all duration-500 ${isRunning ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold shadow-[0_0_15px_rgba(59,130,246,0.2)] animate-pulse' : editedWO.status === WOStatus.COMPLETED ? 'text-green-600 font-bold' : ''}`}>
                                        <Clock size={14} className={`opacity-70 ${isRunning ? 'animate-spin-slow' : ''}`} />
                                        Tiempo: <LiveTimer status={editedWO.status} statusHistory={editedWO.statusHistory} timeSpentMinutes={editedWO.timeSpentMinutes} />
                                    </span>
                                    {editedWO.status === WOStatus.COMPLETED && editedWO.timeSource && (
                                        <span
                                            className={`flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${editedWO.timeSource === 'manual'
                                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                }`}
                                            title={`${editedWO.timeSource === 'manual' ? 'Tiempo escrito a mano' : 'Tiempo medido por sesiones de trabajo'}${editedWO.timeRecordedBy ? ` por ${users.find(u => u.id === editedWO.timeRecordedBy)?.name || '—'}` : ''}${editedWO.timeRecordedAt ? ` el ${new Date(editedWO.timeRecordedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}`}
                                        >
                                            {editedWO.timeSource === 'manual' ? <AlertTriangle size={12} /> : <Check size={12} />}
                                            {editedWO.timeSource === 'manual' ? 'Tiempo manual' : 'Tiempo medido'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Priority */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Prioridad</label>
                            {isEditing ? (
                                <CustomSelect
                                    value={editedWO.priority}
                                    onChange={(val) => setEditedWO({ ...editedWO, priority: val as WOPriority })}
                                    options={Object.values(WOPriority).map(p => ({ value: p, label: p }))}
                                />
                            ) : (
                                <PriorityIndicator priority={editedWO.priority} />
                            )}
                        </div>

                        {/* Equipment */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Equipo / Activo *</label>
                            {isEditing ? (
                                <EquipmentSelector
                                    equipment={equipment}
                                    selectedId={editedWO.equipmentId}
                                    onSelect={(id) => setEditedWO({ ...editedWO, equipmentId: id })}
                                    error={showValidationErrors && !editedWO.equipmentId}
                                />
                            ) : (
                                <div className="flex items-center gap-3 py-1">
                                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                                        <Package size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                            {equipment.find(e => e.id === editedWO.equipmentId)?.name || 'Desconocido'}
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium uppercase truncate tracking-wider">
                                            {equipment.find(e => e.id === editedWO.equipmentId)?.location || 'Ubicación no disp.'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section */}
                        <div>
                            {isEditing ? (
                                <label htmlFor="wo-section" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Sección Principal *</label>
                            ) : (
                                <span className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Sección Principal *</span>
                            )}
                            {isEditing ? (
                                <CustomSelect
                                    value={editedWO.section}
                                    onChange={(val) => setEditedWO({ ...editedWO, section: val })}
                                    options={availableSections.map(s => ({ value: s, label: s }))}
                                    placeholder="Seleccione sección"
                                    disabled={currentUser.role === UserRole.TECHNICIAN}
                                />
                            ) : (
                                <div className="py-2 flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
                                    <span className="capitalize text-slate-900 dark:text-white font-bold text-sm">{editedWO.section}</span>
                                </div>
                            )}
                        </div>

                        {/* Responsible */}
                        <div>
                            {isEditing ? (
                                <label htmlFor="wo-assigned-user" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Responsable Principal</label>
                            ) : (
                                <span className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Responsable Principal</span>
                            )}
                            {isEditing ? (
                                <CustomSelect
                                    value={editedWO.assignedUserId || ''}
                                    onChange={(val) => setEditedWO({ ...editedWO, assignedUserId: val || undefined })}
                                    options={[
                                        { value: "", label: "-- Sin Asignar --" },
                                        ...users.map(u => ({ value: u.id, label: u.name }))
                                    ]}
                                    placeholder="-- Sin Asignar --"
                                    disabled={currentUser.role === UserRole.TECHNICIAN}
                                />
                            ) : (
                                <div className="flex items-center gap-3 py-1">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500">
                                        <UserIcon size={18} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                        {users.find(u => u.id === editedWO.assignedUserId)?.name || 'Sin asignar'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Admin Dates */}
                        {isEditing && currentUser.role === UserRole.ADMIN && (
                            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="col-span-1 md:col-span-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-[-8px]">Ajustes de Administración (Metadatos)</div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Fecha de Creación</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editedWO.createdAt ? toDatetimeLocalValue(editedWO.createdAt) : ''}
                                        onChange={(e) => setEditedWO({
                                            ...editedWO,
                                            createdAt: e.target.value ? new Date(e.target.value).toISOString() : editedWO.createdAt
                                        })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Fecha Programada</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editedWO.scheduledDate ? toDatetimeLocalValue(editedWO.scheduledDate) : ''}
                                        onChange={(e) => setEditedWO({
                                            ...editedWO,
                                            scheduledDate: e.target.value ? new Date(e.target.value).toISOString() : undefined
                                        })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Fecha de Finalización</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full p-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editedWO.closedAt ? toDatetimeLocalValue(editedWO.closedAt) : ''}
                                        onChange={(e) => setEditedWO({
                                            ...editedWO,
                                            closedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined
                                        })}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Collaborating Sections */}
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                <UsersIcon size={16} /> Secciones Colaboradoras
                            </label>
                            <div className={`flex flex-wrap gap-2 items-center min-h-[46px] ${isEditing ? 'p-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl' : ''}`}>
                                {(editedWO.collaboratingSections || []).map(sec => (
                                    <span key={sec} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        {sec}
                                        {isEditing && (
                                            <button
                                                type="button"
                                                onClick={() => setEditedWO({ ...editedWO, collaboratingSections: editedWO.collaboratingSections?.filter(s => s !== sec) })}
                                                className="hover:text-red-500 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </span>
                                ))}
                                {isEditing && (
                                    <div className="relative">
                                        <button
                                            type="button"
                                            className={`p-1.5 rounded-full transition-all ${isAddingCollaboratingSection ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30'}`}
                                            onClick={() => setIsAddingCollaboratingSection(!isAddingCollaboratingSection)}
                                        >
                                            {isAddingCollaboratingSection ? <X size={16} /> : <Plus size={16} />}
                                        </button>
                                        {isAddingCollaboratingSection && (
                                            <div className="absolute left-0 top-full mt-2 w-56 bg-white dark:bg-slate-700 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700 z-30 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                <div className="max-h-48 overflow-y-auto p-1">
                                                    {sections
                                                        .filter(s => s.name !== editedWO.section && !editedWO.collaboratingSections?.includes(s.name))
                                                        .map(s => (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 text-[11px] font-bold uppercase hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors text-slate-700 dark:text-slate-300"
                                                                onClick={() => {
                                                                    setEditedWO({ ...editedWO, collaboratingSections: [...(editedWO.collaboratingSections || []), s.name] });
                                                                    setIsAddingCollaboratingSection(false);
                                                                }}
                                                            >
                                                                {s.name}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {!isEditing && (editedWO.collaboratingSections || []).length === 0 && <span className="text-xs text-slate-400 italic">Ninguna</span>}
                            </div>
                        </div>

                        {/* Collaborators */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                <UserPlus size={16} /> Colaboradores
                            </label>
                            <div className={`flex flex-wrap gap-2 items-center min-h-[46px] ${isEditing ? 'p-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl' : ''}`}>
                                {(editedWO.collaborators || []).map(id => {
                                    const u = users.find(user => user.id === id);
                                    return u ? (
                                        <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                            {u.name.split(' ')[0]}
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditedWO({ ...editedWO, collaborators: editedWO.collaborators?.filter(c => c !== id) })}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </span>
                                    ) : null;
                                })}

                                {isEditing && (
                                    <div className="relative">
                                        <button
                                            type="button"
                                            className={`p-1.5 rounded-full transition-all ${isAddingCollaborator ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
                                            onClick={() => setIsAddingCollaborator(!isAddingCollaborator)}
                                        >
                                            {isAddingCollaborator ? <X size={16} /> : <Plus size={16} />}
                                        </button>

                                        {isAddingCollaborator && (
                                            <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-700 shadow-xl rounded-lg border border-slate-200 dark:border-slate-700 z-30 overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                <div className="max-h-48 overflow-y-auto p-1">
                                                    {users
                                                        .filter(u => {
                                                            if (editedWO.assignedUserId && u.id === editedWO.assignedUserId) return false;
                                                            if (editedWO.collaborators?.includes(u.id)) return false;
                                                            if (u.role === UserRole.OBSERVER_L1 || u.role === UserRole.OBSERVER_L2) return false;
                                                            const allowedSections = [editedWO.section, ...(editedWO.collaboratingSections || [])];
                                                            return u.sections.some(s => allowedSections.includes(s));
                                                        })
                                                        .map(u => (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 text-[11px] font-bold uppercase hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors text-slate-700 dark:text-slate-300"
                                                                onClick={() => {
                                                                    setEditedWO({ ...editedWO, collaborators: [...(editedWO.collaborators || []), u.id] });
                                                                    setIsAddingCollaborator(false);
                                                                }}
                                                            >
                                                                {u.name}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {!isEditing && (editedWO.collaborators || []).length === 0 && <span className="text-xs text-slate-400 italic">Ninguno</span>}
                            </div>
                        </div>
                    </div>

                    {/* Edit Time Spent (Only if completed and editing) */}
                    {isEditing && editedWO.status === WOStatus.COMPLETED && (
                        <div className="col-span-1 md:col-span-2 p-5 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-2xl animate-in fade-in slide-in-from-top-2">
                            <label className="block text-sm font-bold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
                                <Clock size={18} /> Ajustar Tiempo Total Invertido
                            </label>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-24 p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={Math.floor((editedWO.timeSpentMinutes || 0) / 60)}
                                        onChange={(e) => {
                                            const h = Math.max(0, parseInt(e.target.value) || 0);
                                            const m = (editedWO.timeSpentMinutes || 0) % 60;
                                            setEditedWO({ ...editedWO, timeSpentMinutes: h * 60 + m });
                                        }}
                                    />
                                    <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">horas</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        className="w-24 p-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-center font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        value={(editedWO.timeSpentMinutes || 0) % 60}
                                        onChange={(e) => {
                                            const m = Math.min(59, Math.max(0, parseInt(e.target.value) || 0));
                                            const h = Math.floor((editedWO.timeSpentMinutes || 0) / 60);
                                            setEditedWO({ ...editedWO, timeSpentMinutes: h * 60 + m });
                                        }}
                                    />
                                    <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">minutos</span>
                                </div>
                            </div>
                            <p className="text-[10px] text-green-600 dark:text-green-400/60 mt-3 italic font-medium">
                                * Este valor sobrescribirá el tiempo calculado automáticamente por el sistema.
                            </p>
                        </div>
                    )}

                    {/* Description Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Descripción {isEditing ? '(Opcional)' : ''}</label>
                            {isEditing && (
                                <VoiceInputButton
                                    onTranscript={(text) => setEditedWO(prev => ({ ...prev, description: prev.description ? prev.description + ' ' + text : text }))}
                                />
                            )}
                        </div>
                        {isEditing ? (
                            <textarea
                                className="w-full p-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl h-40 text-[13px] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                placeholder="Describa los detalles de la incidencia..."
                                value={editedWO.description}
                                onChange={(e) => setEditedWO({ ...editedWO, description: e.target.value })}
                            />
                        ) : (
                            <div className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap px-1">
                                {editedWO.description || 'Sin descripción adicional.'}
                            </div>
                        )}
                    </div>
                    </>
                    )}

                    {/* Subtasks Section */}
                    {activeTab === 'tareas' && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-8">
                        <WOSubtasksList
                            editedWO={editedWO}
                            setEditedWO={setEditedWO}
                            isEditing={isEditing}
                            users={users}
                        />
                    </div>
                    )}

                    {/* Parts Section - NOT in Create but added here sequentially */}
                    {activeTab === 'piezas' && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-8">
                        <WOPartsList
                            editedWO={editedWO}
                            setEditedWO={setEditedWO}
                            isEditing={isEditing}
                            inventory={inventory}
                        />
                    </div>
                    )}

                    {/* Attachments Section */}
                    {activeTab === 'adjuntos' && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-8">
                        <WOAttachmentsGrid
                            editedWO={editedWO}
                            isEditing={isEditing}
                            handleFileChange={handleFileChange}
                            removeFile={removeFile}
                            setViewMedia={setViewMedia}
                            isUploading={isUploading}
                        />
                    </div>
                    )}

                    {/* Comments e Historial - Moved to bottom and made prominent */}
                    {activeTab === 'actividad' && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-8 pb-10">
                        <WOCommentsSection
                            editedWO={editedWO}
                            currentUser={currentUser}
                            handleSendComment={handleSendComment}
                            setViewMedia={setViewMedia}
                            onDictate={(callback) => { }} // This should be updated in WOCommentsSection to use VoiceInputButton internal or just pass startRecording
                        />
                    </div>
                    )}
                </div>

                {/* Footer */}
                {isEditing && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-100 dark:bg-slate-800 rounded-b-xl sticky bottom-0 z-10">
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setEditedWO({ ...workOrder, subtasks: workOrder.subtasks || [] });
                            }}
                            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-600/20 active:scale-95"
                        >
                            Guardar Cambios
                        </button>
                    </div>
                )}
            </div>

            {/* Media Viewer Lightbox */}
            {viewMedia && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <button onClick={() => setViewMedia(null)} className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                        <X size={32} />
                    </button>
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                        <div className="flex-1 w-full h-full min-h-0 overflow-hidden flex items-center justify-center">
                            {viewMedia.type === 'image' ? (
                                <img src={viewMedia.url} alt={viewMedia.name} className="w-full h-full object-contain shadow-2xl" />
                            ) : viewMedia.type === 'video' ? (
                                <video src={viewMedia.url} controls autoPlay className="max-w-full max-h-full shadow-2xl" />
                            ) : (
                                <div className="bg-white dark:bg-slate-700 p-8 rounded-2xl flex flex-col items-center gap-6">
                                    <FileText size={64} className="text-blue-500" />
                                    <div className="text-center">
                                        <p className="text-lg font-bold dark:text-white mb-2">{viewMedia.name}</p>
                                        <p className="text-sm text-slate-500">Vista previa no disponible para este tipo de archivo.</p>
                                    </div>
                                    <a href={viewMedia.url} download={viewMedia.name} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
                                        Descargar Archivo
                                    </a>
                                </div>
                            )}
                        </div>
                        <p className="text-white font-medium">{viewMedia.name}</p>
                    </div>
                </div>
            )}

            {/* Quick Status Modal Integration (Pause) */}
            {statusActionWO && (
                <QuickStatusModal
                    workOrder={statusActionWO.wo}
                    nextStatus={statusActionWO.nextStatus}
                    onClose={() => setStatusActionWO(null)}
                    onConfirm={(updated) => {
                        onUpdate(updated, false);
                        setEditedWO(updated);
                        setStatusActionWO(null);
                    }}
                    currentUser={currentUser}
                />
            )}

            {/* Quick Complete Modal Integration */}
            {isCompleting && (
                <QuickCompleteModal
                    workOrder={editedWO}
                    onClose={() => setIsCompleting(false)}
                    onConfirm={(updated) => {
                        onUpdate(updated, true); // Update and ask parent to close modal
                        setIsCompleting(false);
                    }}
                    inventory={inventory}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};
