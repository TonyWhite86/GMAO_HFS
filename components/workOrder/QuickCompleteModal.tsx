
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, MessageSquare, Paperclip, X, FileText, UploadCloud, CheckSquare } from 'lucide-react';
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { WorkOrder, WOStatus, InventoryItem, User, Attachment, Comment, ChecklistAnswer } from '../../types';
import { WOPartsList } from './WOPartsList'; // Assuming this is in the same directory or adjust path
import { WOChecklistComplete, isChecklistComplete } from './WOChecklistComplete';
import { useAppStore } from '../../store/useAppStore';
import { computeActiveMinutes } from '../../utils/timeTracking';

export interface QuickCompleteModalProps {
    workOrder: WorkOrder;
    onClose: () => void;
    onConfirm: (updatedWO: WorkOrder) => void;
    inventory: InventoryItem[];
    currentUser: User;
}

export const QuickCompleteModal: React.FC<QuickCompleteModalProps> = ({ workOrder, onClose, onConfirm, inventory, currentUser }) => {
    const initialMins = useMemo(
        () => computeActiveMinutes(workOrder.status, workOrder.statusHistory, workOrder.timeSpentMinutes),
        [workOrder]
    );

    const [editedWO, setEditedWO] = useState<WorkOrder>({
        ...workOrder,
        usedParts: workOrder.usedParts || [],
        attachments: workOrder.attachments || []
    });

    const checklistItems = workOrder.closureChecklist || [];
    const [checklistAnswers, setChecklistAnswers] = useState<Record<string, ChecklistAnswer>>({});
    const checklistOk = isChecklistComplete(checklistItems, checklistAnswers);
    const [hours, setHours] = useState(Math.floor(initialMins / 60));
    const [minutes, setMinutes] = useState(initialMins % 60);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const newAttachments: Attachment[] = files.map(file => ({
            id: crypto.randomUUID(),
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : (file.type === 'application/pdf' ? 'pdf' : 'file')),
            uploadedAt: new Date().toISOString()
        } as any));

        setEditedWO(prev => ({
            ...prev,
            attachments: [...(prev.attachments || []), ...newAttachments]
        }));
    };

    const removeAttachment = (id: string) => {
        setEditedWO(prev => ({
            ...prev,
            attachments: prev.attachments?.filter(a => a.id !== id)
        }));
    };

    const handleFinalConfirm = async () => {
        if (!checklistOk) return;
        const safeHours = isNaN(hours) ? 0 : hours;
        const safeMinutes = isNaN(minutes) ? 0 : minutes;
        const finalTime = safeHours * 60 + safeMinutes;
        try {
            // La BD sella closed_at, append de 'Completada' al historial,
            // recalcula el tiempo y dispara la siguiente OT del plan preventivo.
            await useAppStore.getState().transitionWorkOrder(
                workOrder.id,
                'complete',
                null,
                finalTime,
                checklistItems.length > 0 ? checklistAnswers : null
            );
        } catch (e) {
            console.error('Error completando la OT:', e);
            return;
        }

        const timestamp = new Date().toISOString();
        const historyEntry = { status: WOStatus.COMPLETED, timestamp };
        const newHistory = [...(workOrder.statusHistory || []), historyEntry];

        // Generate system comment
        const finalHoursReported = isNaN(hours) ? 0 : hours;
        const finalMinutesReported = isNaN(minutes) ? 0 : minutes;
        const sysComment: Comment = {
            id: `c-complete-${Date.now()}`,
            userId: 'system',
            userName: currentUser.name,
            text: `Orden completada vía móvil. Tiempo: ${finalHoursReported}h ${finalMinutesReported}m.`,
            createdAt: timestamp,
            isSystem: true,
            status: WOStatus.COMPLETED
        };

        const finalWO: WorkOrder = {
            ...editedWO,
            status: WOStatus.COMPLETED,
            closedAt: timestamp,
            timeSpentMinutes: finalTime,
            statusHistory: newHistory,
            checklistAnswers: checklistItems.length > 0 ? checklistAnswers : editedWO.checklistAnswers,
            comments: [...(workOrder.comments || []), sysComment]
        };

        // Solo estado local: la persistencia ya la hizo transition_work_order.
        onConfirm(finalWO);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
            >
                {/* Header */}
                <div className="p-5 border-b border-line flex justify-between items-center bg-surface-2">
                    <div>
                        <h2 className="text-xl font-bold text-txt">Finalizar Orden</h2>
                        <p className="text-xs text-txt-2 font-mono tracking-wider mt-0.5">#{workOrder.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface-3 rounded-full transition-colors">
                        <X size={24} className="text-txt-3" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Time Input */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-txt-2 flex items-center gap-2">
                            <Clock size={18} className="text-accent" /> Tiempo Invertido
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full p-4 bg-surface-2 border-2 border-line rounded-2xl text-center font-bold text-xl text-txt outline-none focus:border-accent transition-all"
                                    value={isNaN(hours) ? '' : hours}
                                    onChange={e => setHours(e.target.value === '' ? NaN : Math.max(0, parseInt(e.target.value)))}
                                />
                                <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 px-2 bg-surface text-[10px] uppercase font-black text-txt-3">Horas</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    className="w-full p-4 bg-surface-2 border-2 border-line rounded-2xl text-center font-bold text-xl text-txt outline-none focus:border-accent transition-all"
                                    value={isNaN(minutes) ? '' : minutes}
                                    onChange={e => setMinutes(e.target.value === '' ? NaN : Math.min(59, Math.max(0, parseInt(e.target.value))))}
                                />
                                <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 px-2 bg-surface text-[10px] uppercase font-black text-txt-3">Minutos</span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-txt-2 flex items-center gap-2">
                                <MessageSquare size={18} className="text-spec" /> Notas Finales
                            </label>
                            <VoiceInputButton
                                onTranscript={text => setEditedWO(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text }))}
                            />
                        </div>
                        <textarea
                            className="w-full p-4 bg-surface-2 border-2 border-line rounded-2xl text-sm text-txt outline-none focus:border-spec transition-all min-h-[100px] resize-none"
                            placeholder="Añada cualquier detalle sobre el trabajo realizado..."
                            value={editedWO.description}
                            onChange={e => setEditedWO({ ...editedWO, description: e.target.value })}
                        />
                    </div>

                    {/* Spare Parts */}
                    <div className="space-y-1">
                        <WOPartsList
                            editedWO={editedWO}
                            setEditedWO={setEditedWO}
                            isEditing={true}
                            inventory={inventory}
                        />
                    </div>

                    {/* Attachments */}
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-txt-2 flex items-center gap-2">
                            <Paperclip size={18} className="text-ok" /> Fotos y Documentos
                        </label>

                        <div className="flex flex-wrap gap-3">
                            {editedWO.attachments?.map((att) => (
                                <div key={att.id} className="relative group">
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt={att.name} className="w-20 h-20 object-cover rounded-xl border border-line" />
                                    ) : (
                                        <div className="w-20 h-20 bg-surface-2 rounded-xl border border-line flex flex-col items-center justify-center p-2 text-center">
                                            <FileText size={20} className="text-txt-3 mb-1" />
                                            <span className="text-[8px] text-txt-2 truncate w-full">{att.name}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeAttachment(att.id)}
                                        className="absolute -top-2 -right-2 text-white rounded-full p-1 shadow-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'var(--red)' }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <label className="w-20 h-20 border-2 border-dashed border-line rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-2 transition-colors">
                                <UploadCloud size={24} className="text-txt-3" />
                                <span className="text-[10px] font-bold text-txt-3 mt-1">Subir</span>
                                <input type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,video/*,application/pdf" />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Checklist de cierre */}
                {checklistItems.length > 0 && (
                    <div className="p-6 border-t border-line">
                        <WOChecklistComplete
                            items={checklistItems}
                            answers={checklistAnswers}
                            onChange={setChecklistAnswers}
                        />
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-line bg-surface-2">
                    <button
                        onClick={handleFinalConfirm}
                        disabled={!checklistOk}
                        className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${checklistOk
                            ? 'bg-ok hover:bg-ok text-white shadow-ok/20'
                            : 'bg-surface-3 text-txt-3 cursor-not-allowed shadow-none'
                            }`}
                    >
                        <CheckSquare size={24} />
                        {checklistOk ? 'Cerrar Orden de Trabajo' : 'Responde el checklist para cerrar'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
