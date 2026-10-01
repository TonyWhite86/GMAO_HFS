import React, { useState, useRef } from 'react';
import { Home, ChevronRight, FolderPlus, FileUp, Folder, FileText, X, FolderOpen, Trash2 } from 'lucide-react';
import { Equipment, EquipmentDocument } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { supabase } from '../../../lib/supabase';
import { compressImage } from '../../../utils/compressImage';
import { toast } from 'sonner';

interface EquipmentDocumentsProps {
    selectedEquipment: Equipment;
}

export const EquipmentDocuments: React.FC<EquipmentDocumentsProps> = ({ selectedEquipment }) => {
    const { updateEquipment } = useAppStore();

    const [currentDocPath, setCurrentDocPath] = useState<{ id: string; name: string }[]>([]);
    const [isUploadingDocs, setIsUploadingDocs] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentFolderId = currentDocPath.length > 0 ? currentDocPath[currentDocPath.length - 1].id : undefined;
    const currentDocs = (selectedEquipment.documents || []).filter(d => d.parentId === currentFolderId);

    const handleCreateFolder = async () => {
        const name = prompt('Nombre de la carpeta:');
        if (!name) return;

        const newFolder: EquipmentDocument = {
            id: crypto.randomUUID(),
            name,
            type: 'folder',
            parentId: currentFolderId,
            date: new Date().toISOString()
        };

        const updatedDocs = [...(selectedEquipment.documents || []), newFolder];
        await updateEquipment({ ...selectedEquipment, documents: updatedDocs });
        toast.success('Carpeta creada');
    };

    const handleFileUploadDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploadingDocs(true);
        try {
            const newDocs: EquipmentDocument[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${crypto.randomUUID()}.${fileExt}`;
                const filePath = `equipment-docs/${selectedEquipment.id}/${fileName}`;

                let fileToUpload: File | Blob = file;
                if (file.type.startsWith('image/')) {
                    fileToUpload = await compressImage(file);
                }

                const { error: uploadError } = await supabase.storage
                    .from('equipment-photos')
                    .upload(filePath, fileToUpload);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('equipment-photos')
                    .getPublicUrl(filePath);

                newDocs.push({
                    id: crypto.randomUUID(),
                    name: file.name,
                    type: 'file',
                    url: publicUrl,
                    parentId: currentFolderId,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    date: new Date().toISOString()
                });
            }

            const updatedDocs = [...(selectedEquipment.documents || []), ...newDocs];
            await updateEquipment({ ...selectedEquipment, documents: updatedDocs });
            toast.success('Documentos subidos con éxito');
        } catch (error) {
            console.error('Error uploading docs:', error);
            toast.error('Error al subir documentos');
        } finally {
            setIsUploadingDocs(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm('¿Eliminar este elemento?')) return;

        const docToDelete = selectedEquipment.documents.find(d => d.id === docId);
        if (!docToDelete) return;

        if (docToDelete.url) {
            const filePath = docToDelete.url.split('/').pop();
            if (filePath) {
                await supabase.storage
                    .from('equipment-documents')
                    .remove([filePath]);
            }
        }

        let updatedDocs = selectedEquipment.documents.filter(d => d.id !== docId);

        if (docToDelete.type === 'folder') {
            const deleteRecursive = (parentId: string) => {
                const children = updatedDocs.filter(d => d.parentId === parentId);
                children.forEach(c => {
                    updatedDocs = updatedDocs.filter(d => d.id !== c.id);
                    if (c.type === 'folder') deleteRecursive(c.id);
                });
            };
            deleteRecursive(docId);
        }

        await updateEquipment({ ...selectedEquipment, documents: updatedDocs });
        toast.success('Elemento eliminado');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0">
                    <button onClick={() => setCurrentDocPath([])} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                        <Home size={16} />
                    </button>
                    {currentDocPath.map((f, i) => (
                        <React.Fragment key={f.id}>
                            <ChevronRight size={14} className="shrink-0" />
                            <button onClick={() => setCurrentDocPath(currentDocPath.slice(0, i + 1))} className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors max-w-[120px] truncate">
                                {f.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleCreateFolder} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <FolderPlus size={16} />
                        <span>Carpeta</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingDocs} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50">
                        {isUploadingDocs ? <span className="animate-spin mr-1">◌</span> : <FileUp size={16} />}
                        <span>Subir</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUploadDocs} />
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:hidden gap-4 pt-2">
                {currentDocs.map(d => (
                    <div key={d.id} className="flex flex-col items-center gap-2 p-2 group" onClick={() => d.type === 'folder' ? setCurrentDocPath([...currentDocPath, { id: d.id, name: d.name }]) : window.open(d.url, '_blank')}>
                        <div className="relative">
                            <div className="w-16 h-16 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm flex items-center justify-center group-active:scale-95 transition-transform">
                                {d.type === 'folder' ? (
                                    <Folder size={32} className="text-amber-500 fill-amber-50" />
                                ) : (
                                    <div className="relative">
                                        <FileText size={32} className="text-blue-500" />
                                        {d.name.toLowerCase().endsWith('.pdf') && <span className="absolute -bottom-1 -right-1 bg-red-500 text-[8px] text-white px-1 rounded font-bold">PDF</span>}
                                    </div>
                                )}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(d.id); }} className="absolute -top-1 -right-1 w-6 h-6 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center shadow-sm border border-red-100 dark:border-red-900/50">
                                <X size={12} />
                            </button>
                        </div>
                        <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 text-center line-clamp-2 px-1">
                            {d.name}
                        </span>
                    </div>
                ))}
            </div>

            <div className="hidden md:block bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50">
                            <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Nombre</th>
                            <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Tamaño</th>
                            <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Fecha</th>
                            <th className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                        {currentDocs.map(d => (
                            <tr key={d.id} className="group hover:bg-slate-100 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="p-3">
                                    <button onClick={() => d.type === 'folder' ? setCurrentDocPath([...currentDocPath, { id: d.id, name: d.name }]) : window.open(d.url, '_blank')} className="flex items-center gap-3 text-slate-900 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                                        {d.type === 'folder' ? <Folder size={18} className="text-amber-500" /> : <FileText size={18} className="text-blue-500" />}
                                        {d.name}
                                    </button>
                                </td>
                                <td className="p-3 text-slate-500 dark:text-slate-400">{d.size || '-'}</td>
                                <td className="p-3 text-slate-500 dark:text-slate-400">{new Date(d.date).toLocaleDateString()}</td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleDeleteDoc(d.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {currentDocs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-50/50 dark:bg-slate-700/20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    <FolderOpen size={48} className="text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Esta carpeta está vacía</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Crea una subcarpeta o sube un archivo para empezar</p>
                </div>
            )}
        </div>
    );
};
