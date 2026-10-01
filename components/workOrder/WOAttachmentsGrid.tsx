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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Paperclip size={16} /> Archivos Adjuntos
                </label>
                {isEditing && (
                    <button
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-xs font-medium active:scale-95 shadow-sm shadow-blue-600/20"
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
                                className={`group relative bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col items-center overflow-hidden transition-colors ${isImg ? 'cursor-pointer hover:border-blue-400' : ''}`}
                                onClick={() => {
                                    if (isImg) setViewMedia({ type: 'image', url: att.url, name: att.name });
                                }}
                            >
                                <div className="w-full h-24 bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden relative">
                                    {isImg ? (
                                        <>
                                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                                <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                            </div>
                                        </>
                                    ) : (
                                        <FileText size={32} className="text-slate-400" />
                                    )}
                                </div>
                                <div className="p-2 w-full">
                                    <span className="block text-xs text-slate-700 dark:text-slate-300 font-medium truncate w-full text-center" title={att.name}>
                                        {att.name}
                                    </span>
                                </div>

                                {isEditing && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                                        className="absolute top-1 right-1 p-1 bg-white dark:bg-slate-600 rounded-full shadow text-red-500 hover:bg-red-50 z-10"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 dark:text-slate-500">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 text-slate-400 dark:text-slate-500">
                            <Plus size={32} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">No hay archivos adjuntos</span>
                    </div>
                )}
            </div>
        </div>
    );
};
