import React, { useState, useRef } from 'react';
import { Plus, Mic, Send, X, Loader2, StopCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { compressImage } from '../../utils/compressImage';
import { toast } from 'sonner';
import { Attachment } from '../../types';
import { VoiceInputButton } from '../ui/VoiceInputButton';

interface CommentInputProps {
    onSend: (text: string, attachments: Attachment[]) => void;
    storageBucket: string;
    placeholder?: string;
    onDictate?: (callback: (text: string) => void) => void;
    disabled?: boolean;
}

export const CommentInput: React.FC<CommentInputProps> = ({
    onSend,
    storageBucket,
    placeholder = "Escribe un comentario...",
    onDictate,
    disabled = false
}) => {
    const [text, setText] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

                    const compressedFile = await compressImage(file);
                    const { error: uploadError } = await supabase.storage
                        .from(storageBucket)
                        .upload(filePath, compressedFile);

                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage.from(storageBucket).getPublicUrl(filePath);

                    newAttachments.push({
                        id: Math.random().toString(36).substring(7),
                        name: file.name,
                        url: data.publicUrl,
                        type: file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : (file.type === 'application/pdf' ? 'pdf' : 'file'))
                    });
                }
                setAttachments(prev => [...prev, ...newAttachments]);
                toast.success('Archivos adjuntados');
            } catch (error) {
                console.error('Error uploading files:', error);
                toast.error('Error al subir archivos');
            } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveAttachment = async (idx: number) => {
        const fileToDelete = attachments[idx];
        if (fileToDelete) {
            try {
                const fileName = fileToDelete.url.split('/').pop();
                if (fileName) {
                    await supabase.storage.from(storageBucket).remove([fileName]);
                }
            } catch (e) {
                console.error('Error removing file', e);
            }
        }
        setAttachments(prev => prev.filter((_, i) => i !== idx));
    };

    const submitComment = () => {
        if (!text.trim() && attachments.length === 0) return;
        onSend(text, attachments);
        setText('');
        setAttachments([]);
    };

    return (
        <div className="space-y-4">
            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {attachments.map((file, idx) => (
                        <div key={idx} className="relative group">
                            <div className="w-16 h-16 rounded-lg border border-line overflow-hidden" style={{ background: 'var(--surface)' }}>
                                {file.type === 'image' ? (
                                    <img src={file.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <StopCircle size={24} className="text-txt-3" />
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleRemoveAttachment(idx)}
                                className="absolute -top-1 -right-1 rounded-full p-0.5 shadow-sm transition-colors" style={{ background: 'var(--red)', color: '#fff' }}
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input row */}
            <div className="flex gap-2 items-end">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*,video/*,application/pdf"
                    onChange={handleFileChange}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-txt-3 hover:text-accent rounded-[10px] transition-all border border-line shrink-0"
                    title="Adjuntar"
                    disabled={isUploading || disabled}
                >
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                </button>

                {onDictate && (
                    <VoiceInputButton
                        onTranscript={(dictatedText) => setText(prev => prev ? prev + ' ' + dictatedText : dictatedText)}
                        className="mb-1"
                    />
                )}

                <div className="flex-1 relative">
                    <textarea
                        className="fld-input w-full p-3 text-sm rounded-[10px] transition-all resize-none min-h-[46px] max-h-32 placeholder:text-txt-3"
                        placeholder={placeholder}
                        rows={1}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submitComment();
                            }
                        }}
                        disabled={disabled}
                    />
                </div>

                <button
                    type="button"
                    onClick={submitComment}
                    disabled={(!text.trim() && attachments.length === 0) || isUploading || disabled}
                    className="btn btn-primary disabled:opacity-50 p-3.5 rounded-[10px] flex items-center justify-center shrink-0 mb-0.5"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};
