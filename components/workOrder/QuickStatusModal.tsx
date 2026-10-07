import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, PauseCircle } from 'lucide-react';
import { VoiceInputButton } from '../ui/VoiceInputButton';
import { WorkOrder, WOStatus, User, Comment } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { computeActiveMinutes, hasActiveSession } from '../../utils/timeTracking';

interface QuickStatusModalProps {
    workOrder: WorkOrder;
    nextStatus: WOStatus;
    onClose: () => void;
    onConfirm: (updatedWO: WorkOrder) => void;
    currentUser: User;
}

export const QuickStatusModal: React.FC<QuickStatusModalProps> = ({ workOrder, nextStatus, onClose, onConfirm, currentUser }) => {
    const [reason, setReason] = useState('');
    // Running = IN_PROGRESS with an open session. Pausing closes the session but
    // keeps status IN_PROGRESS, so a paused WO is IN_PROGRESS without an open session.
    const isRunning = workOrder.status === WOStatus.IN_PROGRESS && hasActiveSession(workOrder.statusHistory);
    const isPausing = isRunning;
    const isResuming = workOrder.status === WOStatus.IN_PROGRESS && !isRunning;
    // When pausing, add PENDING to history (closes the session) but keep status IN_PROGRESS
    const historyStatus = isPausing ? WOStatus.PENDING : nextStatus;

    const handleConfirm = async () => {
        const action = isPausing ? 'pause' : isResuming ? 'resume' : 'start';
        try {
            // La BD es la única dueña de status_history / time_spent_minutes /
            // closed_at: el RPC hace append de la sesión y recalcula el tiempo.
            await useAppStore.getState().transitionWorkOrder(
                workOrder.id,
                action as 'start' | 'pause' | 'resume',
                isPausing ? (reason || null) : null
            );
        } catch (e) {
            console.error('Error transicionando la OT:', e);
            return;
        }

        const timestamp = new Date().toISOString();
        const historyEntry = { status: historyStatus, timestamp };

        // On start, drop a trailing abandoned IN_PROGRESS entry (e.g. session
        // left open across a browser close/reload). Otherwise it would merge
        // with the new session and inflate the counter.
        let baseHistory = workOrder.statusHistory || [];
        if (!isPausing) {
            const last = baseHistory[baseHistory.length - 1];
            if (last && last.status === WOStatus.IN_PROGRESS) {
                baseHistory = baseHistory.slice(0, -1);
            }
        }
        const newHistory = [...baseHistory, historyEntry];

        // Persist a precise snapshot of the accumulated closed time so the
        // counter is safe even if history is later truncated.
        const baseForTime = isPausing ? newHistory : baseHistory;
        const timeSpent = computeActiveMinutes(
            WOStatus.IN_PROGRESS,
            baseForTime,
            workOrder.timeSpentMinutes
        );

        const sysComment: Comment = {
            id: `c-status-${Date.now()}`,
            userId: 'system',
            userName: currentUser.name,
            text: isPausing
                ? `Trabajo pausado vía móvil. Motivo: ${reason || 'No indicado'}`
                : isResuming
                    ? `Trabajo reanudado vía móvil.`
                    : `Trabajo iniciado vía móvil.`,
            createdAt: timestamp,
            isSystem: true,
            status: historyStatus
        };

        const updatedWO: WorkOrder = {
            ...workOrder,
            status: isPausing ? WOStatus.IN_PROGRESS : nextStatus,
            statusHistory: newHistory,
            timeSpentMinutes: timeSpent,
            comments: [...(workOrder.comments || []), sysComment],
            pendingReason: isPausing ? reason : undefined
        };

        // Solo estado local: la persistencia (incluido el comentario de
        // sistema) ya la hizo transition_work_order.
        onConfirm(updatedWO);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
                <div className={`p-6 ${isPausing ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isPausing ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isPausing ? <PauseCircle size={32} /> : <PlayCircle size={32} />}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                {isPausing ? '¿Pausar Trabajo?' : isResuming ? '¿Reanudar Trabajo?' : '¿Iniciar Trabajo?'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Orden #{workOrder.id}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {isPausing && (
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Motivo de la Pausa</label>
                                <VoiceInputButton
                                    onTranscript={text => setReason(prev => prev ? `${prev} ${text}` : text)}
                                />
                            </div>
                            <textarea
                                className="w-full p-4 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 min-h-[100px] resize-none"
                                placeholder="Indique por qué se detiene el trabajo..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}

                    {!isPausing && (
                        <p className="text-slate-600 dark:text-slate-300">
                            {isResuming
                                ? 'Se reanudará el trabajo y se registrará en el historial de la orden.'
                                : 'Se registrará el inicio del trabajo en el historial de la orden.'}
                        </p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 ${isPausing ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
                        >
                            {isPausing ? 'Pausar' : isResuming ? 'Reanudar' : 'Iniciar'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
