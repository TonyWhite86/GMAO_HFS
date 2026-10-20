import React, { useState } from 'react';
import { Plus, Trash2, ClipboardCheck, FolderOpen, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { ChecklistItem, ChecklistTemplate } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { CustomSelect } from '../ui/CustomSelect';
import { ChecklistTemplatesModal } from './ChecklistTemplatesModal';

interface WOChecklistEditorProps {
    items: ChecklistItem[];
    onChange: (items: ChecklistItem[]) => void;
}

let seq = 0;
const newItem = (text = ''): ChecklistItem => ({
    id: `cl-${Date.now()}-${seq++}`,
    text
});

export const WOChecklistEditor: React.FC<WOChecklistEditorProps> = ({ items, onChange }) => {
    const checklistTemplates = useAppStore(s => s.checklistTemplates);
    const addChecklistTemplate = useAppStore(s => s.addChecklistTemplate);
    const [templateId, setTemplateId] = useState('');
    const [saveName, setSaveName] = useState('');
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);
    const [isManaging, setIsManaging] = useState(false);

    const activeTemplates = checklistTemplates.filter(t => t.active);

    const applyTemplate = (id: string) => {
        setTemplateId(id);
        const tpl = checklistTemplates.find(t => t.id === id);
        if (!tpl) return;
        // Copia profunda con ids nuevos para no compartir referencias
        onChange(tpl.items.map(it => newItem(it.text)));
        toast.success(`Plantilla "${tpl.name}" aplicada`);
    };

    const handleSaveTemplate = async () => {
        const name = saveName.trim();
        if (!name) {
            toast.error('Indica un nombre para la plantilla');
            return;
        }
        if (items.filter(it => it.text.trim()).length === 0) {
            toast.error('Añade al menos un punto antes de guardar la plantilla');
            return;
        }
        setIsSavingTemplate(true);
        try {
            await addChecklistTemplate({ name, items: items.filter(it => it.text.trim()) } as Partial<ChecklistTemplate>);
            setSaveName('');
        } catch {
            // el slice muestra el error
        } finally {
            setIsSavingTemplate(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider">
                    <ClipboardCheck size={14} />
                    Checklist de cierre
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                    {activeTemplates.length > 0 && (
                        <div className="w-44">
                            <CustomSelect
                                value={templateId}
                                onChange={applyTemplate}
                                options={activeTemplates.map(t => ({ value: t.id, label: t.name }))}
                                placeholder="Cargar plantilla…"
                                size="sm"
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsManaging(true)}
                        className="btn btn-ghost btn-sm"
                        title="Gestionar plantillas"
                    >
                        <Settings2 size={13} />
                        Plantillas
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-txt-3 w-5 text-right shrink-0">{idx + 1}.</span>
                        <input
                            type="text"
                            value={item.text}
                            onChange={(e) => {
                                const next = items.map(it => it.id === item.id ? { ...it, text: e.target.value } : it);
                                onChange(next);
                            }}
                            placeholder="Punto de verificación (p. ej. Presión de aceite OK)"
                            className="fld-input flex-1 px-3 py-2 rounded-[6px] outline-none text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => onChange(items.filter(it => it.id !== item.id))}
                            className="btn btn-ghost btn-icon shrink-0"
                            title="Quitar punto"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                ))}
                <button
                    type="button"
                    onClick={() => onChange([...items, newItem()])}
                    className="btn btn-ghost btn-sm"
                >
                    <Plus size={13} />
                    Añadir punto
                </button>
            </div>

            {items.length > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-[10px] bg-surface-2 border border-line">
                    <Save size={14} className="text-txt-3 shrink-0" />
                    <input
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Nombre de la plantilla…"
                        className="fld-input flex-1 px-2.5 py-1.5 rounded-[6px] outline-none text-xs"
                    />
                    <button
                        type="button"
                        onClick={handleSaveTemplate}
                        disabled={isSavingTemplate}
                        className="btn btn-accent-ghost btn-sm shrink-0"
                    >
                        <FolderOpen size={13} />
                        Guardar como plantilla
                    </button>
                </div>
            )}

            {isManaging && (
                <ChecklistTemplatesModal
                    isOpen={isManaging}
                    onClose={() => setIsManaging(false)}
                />
            )}
        </div>
    );
};
