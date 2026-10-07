
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, MessageSquare, Paperclip, X, FileText, UploadCloud, CheckSquare } from 'lucide-react';
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { WorkOrder, WOStatus, InventoryItem, User, Attachment, Comment } from '../../types';
import { WOPartsList } from './WOPartsList'; // Assuming this is in the same directory or adjust path
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
                finalTime
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
                className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden"
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-100 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Finalizar Orden</h2>
                        <p className="text-xs text-slate-500 font-mono tracking-wider mt-0.5">#{workOrder.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    {/* Time Input */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Clock size={18} className="text-blue-500" /> Tiempo Invertido
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full p-4 bg-slate-100 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-center font-bold text-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
                                    value={isNaN(hours) ? '' : hours}
                                    onChange={e => setHours(e.target.value === '' ? NaN : Math.max(0, parseInt(e.target.value)))}
                                />
                                <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 px-2 bg-white dark:bg-slate-800 text-[10px] uppercase font-black text-slate-400">Horas</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    className="w-full p-4 bg-slate-100 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-center font-bold text-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
                                    value={isNaN(minutes) ? '' : minutes}
                                    onChange={e => setMinutes(e.target.value === '' ? NaN : Math.min(59, Math.max(0, parseInt(e.target.value))))}
                                />
                                <span className="absolute left-1/2 -translate-x-1/2 -bottom-2 px-2 bg-white dark:bg-slate-800 text-[10px] uppercase font-black text-slate-400">Minutos</span>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <MessageSquare size={18} className="text-purple-500" /> Notas Finales
                            </label>
                            <VoiceInputButton
                                onTranscript={text => setEditedWO(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text }))}
                            />
                        </div>
                        <textarea
                            className="w-full p-4 bg-slate-100 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white outline-none focus:border-purple-500 transition-all min-h-[100px] resize-none"
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
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Paperclip size={18} className="text-emerald-500" /> Fotos y Documentos
                        </label>

                        <div className="flex flex-wrap gap-3">
                            {editedWO.attachments?.map((att) => (
                                <div key={att.id} className="relative group">
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt={att.name} className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                                    ) : (
                                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-2 text-center">
                                            <FileText size={20} className="text-slate-400 mb-1" />
                                            <span className="text-[8px] text-slate-500 truncate w-full">{att.name}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeAttachment(att.id)}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <label className="w-20 h-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <UploadCloud size={24} className="text-slate-300" />
                                <span className="text-[10px] font-bold text-slate-400 mt-1">Subir</span>
                                <input type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,video/*,application/pdf" />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50">
                    <button
                        onClick={handleFinalConfirm}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-green-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <CheckSquare size={24} />
                        Cerrar Orden de Trabajo
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
