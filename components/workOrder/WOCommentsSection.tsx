import React from 'react';
import { ActivityTimeline } from '../common/ActivityTimeline';
import { CommentInput } from '../common/CommentInput';
import { WorkOrder, User, Attachment } from '../../types';

interface WOCommentsSectionProps {
    editedWO: WorkOrder;
    currentUser: User;
    handleSendComment: (text: string, attachments?: Attachment[]) => void;
    setViewMedia: (media: { type: 'image' | 'video' | 'pdf' | 'file'; url: string; name: string } | null) => void;
    onDictate?: (callback: (text: string) => void) => void;
}

export const WOCommentsSection: React.FC<WOCommentsSectionProps> = ({
    editedWO,
    currentUser,
    handleSendComment,
    setViewMedia,
    onDictate
}) => {
    return (
        <div className="border-t border-slate-800 pt-6 space-y-6">
            {/* Unified Input */}
            <CommentInput
                onSend={handleSendComment}
                storageBucket="work-order-files"
                onDictate={onDictate}
                placeholder="Nuevo comentario o actualización..."
            />

            {/* Actividad: log de eventos (work_order_events) + comentarios */}
            <ActivityTimeline
                workOrder={editedWO}
                comments={editedWO.comments || []}
                currentUserId={currentUser.id}
                setViewMedia={setViewMedia}
                title="Actividad e historial"
                emptyMessage="No hay actividad todavía. Registra el primer avance."
            />
        </div>
    );
};
