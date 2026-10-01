import React from 'react';
import { StopCircle, MessageSquare } from 'lucide-react';
import { Attachment } from '../../types';
import { WO_STATUS_CONFIG } from '../../constants';

export interface SharedComment {
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: string;
    isSystem?: boolean;
    status?: any; // For WO specific status system messages
    attachments?: Attachment[];
}

interface CommentTimelineProps {
    comments: SharedComment[];
    currentUserId?: string;
    setViewMedia: (media: { type: 'image' | 'video' | 'pdf' | 'file'; url: string; name: string } | null) => void;
    title?: string;
    emptyMessage?: string;
    maxHeight?: string;
}

export const CommentTimeline: React.FC<CommentTimelineProps> = ({
    comments,
    currentUserId,
    setViewMedia,
    title = "Comentarios e Historial",
    emptyMessage = "No hay comentarios todavía.",
    maxHeight = "400px"
}) => {
    return (
        <div className="space-y-4">
            {title && (
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MessageSquare size={16} /> {title}
                </h3>
            )}

            <div
                className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex flex-col"
                style={{ maxHeight }}
            >
                {comments.length > 0 ? (
                    [...comments].reverse().map((comment) => (
                        <div
                            key={comment.id}
                            className={`flex gap-3 ${comment.userId === currentUserId ? 'flex-row-reverse' : ''}`}
                        >
                            {!comment.isSystem && (
                                <div className={`hidden sm:flex w-8 h-8 rounded-full items-center justify-center text-xs font-bold text-white shrink-0 ${comment.userId === currentUserId ? 'bg-blue-600' : 'bg-slate-400'}`}>
                                    {(comment.userName || 'U').charAt(0)}
                                </div>
                            )}

                            <div className={`max-w-[85%] rounded-lg p-3 ${comment.isSystem
                                ? `text-sm border ${comment.status ? WO_STATUS_CONFIG[comment.status]?.bgClass : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 italic border-slate-200 dark:border-slate-700'} text-center w-full`
                                : (comment.userId === currentUserId
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200')
                                }`}>
                                {!comment.isSystem && (
                                    <div className="flex justify-between items-center gap-4 mb-1">
                                        <span className="text-xs opacity-70 font-bold">{comment.userName}</span>
                                        <span className="text-[10px] opacity-50">
                                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}

                                <div className="text-sm leading-relaxed">{comment.text}</div>

                                {/* Attachments */}
                                {comment.attachments && comment.attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {comment.attachments.map((att, idx) => (
                                            <div
                                                key={idx}
                                                className="relative group cursor-pointer overflow-hidden rounded border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                                                onClick={() => setViewMedia({ type: att.type as any, url: att.url, name: att.name })}
                                            >
                                                <div className="w-20 h-20">
                                                    {att.type === 'image' ? (
                                                        <img src={att.url} alt={att.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                                                            <StopCircle size={20} className="text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-8 text-slate-400 text-sm italic">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    );
};
