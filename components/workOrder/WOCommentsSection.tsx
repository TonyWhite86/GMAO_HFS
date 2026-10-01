import React from 'react';
import { SharedComment, CommentTimeline } from '../common/CommentTimeline';
import { CommentInput } from '../common/CommentInput';
import { WorkOrder, User, WOStatus, Attachment } from '../../types';

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
    // Map WO comments to SharedComment format if necessary (they are already compatible)
    const sharedComments: SharedComment[] = (editedWO.comments || []).map(c => ({
        ...c,
        status: (c as any).status // Maintain status for system messages
    }));

    return (
        <div className="border-t border-slate-800 pt-6 space-y-6">
            {/* Unified Input */}
            <CommentInput
                onSend={handleSendComment}
                storageBucket="work-order-files"
                onDictate={onDictate}
                placeholder="Nuevo comentario o actualización..."
            />

            {/* Unified Timeline */}
            <CommentTimeline
                comments={sharedComments}
                currentUserId={currentUser.id}
                setViewMedia={setViewMedia}
                title="Evolución y Comentarios"
                emptyMessage="No hay comentarios todavía. Registra el primer avance."
            />
        </div>
    );
};
