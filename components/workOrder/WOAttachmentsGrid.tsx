import React, { useRef } from 'react';
import { Paperclip, Plus, ZoomIn, FileText, Trash2, Loader2 } from 'lucide-react';
import { WorkOrder, Attachment } from '../../types';

interface WOAttachmentsGridProps {
    editedWO: WorkOrder;
    isEditing: boolean;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeFile: (index: number) => void;
    setViewMedia: (media: { type: 'image' | 'video'; url: string; name: string } | null) => void;
    isUploading?: boolean;
}

export const WOAttachmentsGrid: React.FC<WOAttachmentsGridProps> = ({
    editedWO,
    isEditing,
    handleFileChange,
    removeFile,
    setViewMedia,
    isUploading = false
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <label className="block text-xs font-bold text-txt-2 uppercase tracking-wider flex items-center gap-2">
                    <Paperclip size={16} /> Archivos Adjuntos
                </label>
                {isEditing && (
                    <button
                        className="flex items-center gap-2 px-3 py-1.5 btn btn-primary text-white rounded-lg transition-all text-xs font-medium active:scale-95 shadow-sm shadow-accent/20"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                    >
                        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        <span>{isUploading ? 'Subiendo...' : 'Añadir archivo'}</span>
                        <input
                            type="file"
                            ref={fileInputRef}
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {editedWO.attachments && editedWO.attachments.length > 0 ? (
                    editedWO.attachments.map((att, idx) => {
                        const isImg = att.type === 'image';
                        return (
                            <div
                                key={idx}
                                className={`group relative bg-surface-2 border border-line rounded-lg flex flex-col items-center overflow-hidden transition-colors ${isImg ? 'cursor-pointer hover:border-accent' : ''}`}
                                onClick={() => {
                                    if (isImg) setViewMedia({ type: 'image', url: att.url, name: att.name });
                                }}
                            >
                                <div className="w-full h-24 bg-surface-3 flex items-center justify-center overflow-hidden relative">
                                    {isImg ? (
                                        <>
                                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                                <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                            </div>
                                        </>
                                    ) : (
                                        <FileText size={32} className="text-txt-3" />
                                    )}
                                </div>
                                <div className="p-2 w-full">
                                    <span className="block text-xs text-txt-2 font-medium truncate w-full text-center" title={att.name}>
                                        {att.name}
                                    </span>
                                </div>

                                {isEditing && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                        className="absolute top-1 right-1 p-1 bg-white rounded-full shadow text-ko hover:bg-ko-dim z-10"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-surface-2 bg-surface/30 border-2 border-dashed border-line rounded-2xl text-txt-3">
                        <div className="p-4 bg-surface-2 rounded-full mb-3 text-txt-3">
                            <Plus size={32} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">No hay archivos adjuntos</span>
                    </div>
                )}
            </div>
        </div>
    );
};
