import React, { useState, useEffect } from 'react';
import { Equipment } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { Camera, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useFileUpload } from '../../../hooks/useFileUpload';
import { Modal } from '../../../components/ui/Modal';

interface EquipmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    equipment?: Equipment | null;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
    isOpen,
    onClose,
    equipment
}) => {
    const { equipment: equipmentList, sections, addEquipment, updateEquipment } = useAppStore();
    const isEditMode = !!equipment;

    // Use the hook
    const { uploadFiles, removeFile, isUploading } = useFileUpload();

    const [newEqData, setNewEqData] = useState<Partial<Equipment>>({
        name: '',
        parentId: undefined,
        sections: [],
        location: '',
        manufacturer: '',
        serialNumber: '',
        status: 'Operativo' as any,
        photoUrl: undefined,
        code: ''
    });

    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCodeDuplicate, setIsCodeDuplicate] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (equipment) {
                setNewEqData({ ...equipment });
                setPreviewPhoto(equipment.photoUrl || null);
            } else {
                setNewEqData({
                    name: '',
                    parentId: undefined,
                    sections: [],
                    location: '',
                    manufacturer: '',
                    serialNumber: '',
                    status: 'Operativo' as any,
                    photoUrl: undefined,
                    code: ''
                });
                setPreviewPhoto(null);
            }
        }
    }, [isOpen, equipment]);

    useEffect(() => {
        if (newEqData.code) {
            const duplicate = equipmentList.some(eq =>
                eq.code?.toLowerCase() === newEqData.code?.toLowerCase() &&
                eq.id !== equipment?.id
            );
            setIsCodeDuplicate(duplicate);
        } else {
            setIsCodeDuplicate(false);
        }
    }, [newEqData.code, equipmentList, equipment]);

    if (!isOpen) return null;

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Clean up previous temp photo if it exists and is different from original
            const currentTempUrl = newEqData.photoUrl;
            const originalUrl = equipment ? equipment.photoUrl : null;

            if (currentTempUrl && currentTempUrl !== originalUrl && currentTempUrl.includes('equipment-photos')) {
                await removeFile(currentTempUrl, 'equipment-photos');
            }

            // Upload new file
            // Note: The hook handles compression if implemented in it, otherwise we might rely on the hook's default behavior.
            // Assuming useFileUpload handles generic file uploads. 
            // 'equipment-photos' is the bucket, 'equipment' is the module/folder hint
            const uploadedFiles = await uploadFiles([file], 'equipment-photos', 'equipment');

            if (uploadedFiles.length > 0) {
                const newUrl = uploadedFiles[0].url;
                setNewEqData(prev => ({ ...prev, photoUrl: newUrl }));
                setPreviewPhoto(newUrl);
            }

        } catch (error) {
            // Error handled by hook
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEqData.name) {
            toast.error("El nombre es obligatorio");
            return;
        }

        try {
            setIsSaving(true);
            if (isEditMode && equipment) {
                await updateEquipment(newEqData as Equipment);
            } else {
                // Ensure required fields for new equipment
                const eqToCreate = {
                    ...newEqData,
                    id: crypto.randomUUID(),
                    documents: [],
                };
                await addEquipment(eqToCreate as Equipment);
            }
            onClose();
        } catch (error) {
            // Error is handled by store
        } finally {
            setIsSaving(false);
        }
    };

    const isSubmitDisabled = isSaving || isUploading || isCodeDuplicate;

    const handleCancel = async () => {
        // Cleanup orphaned photo if it was changed but not saved
        const originalUrl = equipment?.photoUrl;
        const currentUrl = newEqData.photoUrl;

        if (currentUrl && currentUrl !== originalUrl && currentUrl.includes('equipment-photos')) {
            await removeFile(currentUrl, 'equipment-photos');
        }
        onClose();
    };

    return (
        <Modal onClose={handleCancel} size="lg">
            <Modal.Header
                onClose={handleCancel}
                icon={<div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Camera size={20} /></div>}
            >
                {isEditMode ? 'Editar Equipo' : 'Crear Nuevo Equipo'}
            </Modal.Header>

            <Modal.Body>
                <form id="equipment-form" onSubmit={handleSave} className="space-y-6">
                    {/* Photo Upload */}
                    <div className="flex justify-center">
                        <div className="relative group cursor-pointer w-32 h-32 rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                            {isUploading ? (
                                <div className="flex flex-col items-center justify-center text-blue-500">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mb-2"></div>
                                    <span className="text-xs font-medium">Subiendo...</span>
                                </div>
                            ) : previewPhoto ? (
                                <img src={previewPhoto} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <Camera size={24} className="mx-auto mb-1" />
                                    <span className="text-xs">Subir Foto</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} className="absolute inset-0 opacity-0 cursor-pointer disabled:pointer-events-none" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código Interno</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    value={newEqData.code || ''}
                                    onChange={e => setNewEqData({ ...newEqData, code: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-colors ${isCodeDuplicate
                                            ? 'border-red-500 dark:border-red-500 pr-10'
                                            : 'border-slate-300 dark:border-slate-600'
                                        }`}
                                    placeholder="EQ-2025-..."
                                />
                                {isCodeDuplicate && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                    </div>
                                )}
                            </div>
                            {isCodeDuplicate && (
                                <p className="mt-1 text-xs text-red-500 font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                    Este código ya está en uso por otro equipo
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Equipo</label>
                            <input
                                type="text"
                                required
                                value={newEqData.name}
                                onChange={e => setNewEqData({ ...newEqData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej. Compresor B"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Equipo Superior (Padre)</label>
                            <select
                                value={newEqData.parentId || ''}
                                onChange={e => setNewEqData({ ...newEqData, parentId: e.target.value || undefined })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                                <option value="">-- Ninguno (Raíz) --</option>
                                {equipmentList.map(eq => (
                                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Secciones</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700">
                                {sections.map(section => (
                                    <label key={section.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs font-medium ${newEqData.sections?.includes(section.name) ? 'bg-blue-50 text-blue-600' : ''}`}>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={!!newEqData.sections?.includes(section.name)}
                                            onChange={() => {
                                                const current = newEqData.sections || [];
                                                const next = current.includes(section.name) ? current.filter(s => s !== section.name) : [...current, section.name];
                                                setNewEqData({ ...newEqData, sections: next });
                                            }}
                                        />
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${newEqData.sections?.includes(section.name) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                                            {newEqData.sections?.includes(section.name) && <Check size={12} />}
                                        </div>
                                        {section.name}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ubicación Física</label>
                            <input
                                type="text"
                                value={newEqData.location || ''}
                                onChange={e => setNewEqData({ ...newEqData, location: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                            <select
                                value={newEqData.status}
                                onChange={e => setNewEqData({ ...newEqData, status: e.target.value as any })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                                <option value="Operativo">Operativo</option>
                                <option value="En Producción">En Producción</option>
                                <option value="Parada Planificada">Parada Planificada</option>
                                <option value="Averiado">Averiado</option>
                                <option value="Reparación">Reparación</option>
                                <option value="Inactivo">Inactivo</option>
                                <option value="Baja">Baja</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fabricante</label>
                            <input
                                type="text"
                                value={newEqData.manufacturer || ''}
                                onChange={e => setNewEqData({ ...newEqData, manufacturer: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nº Serie</label>
                            <input
                                type="text"
                                value={newEqData.serialNumber || ''}
                                onChange={e => setNewEqData({ ...newEqData, serialNumber: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>
                </form>
            </Modal.Body>

            <Modal.Footer>
                <button type="button" onClick={handleCancel} className="px-4 py-2 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                <button
                    type="submit"
                    form="equipment-form"
                    disabled={isSubmitDisabled}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                    {isEditMode ? 'Guardar Cambios' : 'Crear Equipo'}
                </button>
            </Modal.Footer>
        </Modal>
    );
};
