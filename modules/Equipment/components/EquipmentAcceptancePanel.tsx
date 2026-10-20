import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Printer, Plus, Trash2, ClipboardCheck, GraduationCap, Building2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../../store/useAppStore';
import { Equipment, EquipmentSignoff, EquipmentTraining, DOCUMENT_CATEGORIES } from '../../../types';
import { isWildcardUser } from '../../../utils/incidentVisibility';

interface EquipmentAcceptanceProps {
    equipment: Equipment;
}

let seq = 0;
const newId = () => `acc-${Date.now()}-${seq++}`;
const today = () => new Date().toISOString().slice(0, 10);

/** ¿Puede editar la aceptación? Admin, Responsable Sección o comodín. */
const canEditAcceptance = (
    role: string | undefined,
    sections: string[],
    catalogSections: { name: string; isWildcard: boolean }[]
): boolean => {
    if (!role) return false;
    if (role === 'Admin' || role === 'Responsable Sección') return true;
    return isWildcardUser({ role: role as any, sections }, catalogSections);
};

export const EquipmentAcceptancePanel: React.FC<EquipmentAcceptanceProps> = ({ equipment }) => {
    const {
        equipmentAcceptance, users, saveEquipmentAcceptance,
        currentUser, sections: catalogSections
    } = useAppStore();

    const acceptance = useMemo(
        () => equipmentAcceptance.find(a => a.equipmentId === equipment.id)
            || { equipmentId: equipment.id, manualsOk: false, conformityOk: false, signoffs: [], trainings: [] },
        [equipmentAcceptance, equipment.id]
    );

    const canEdit = canEditAcceptance(currentUser?.role, currentUser?.sections || [], catalogSections);

    // Formularios de alta
    const [signDept, setSignDept] = useState('');
    const [signUser, setSignUser] = useState('');
    const [signDate, setSignDate] = useState(today());
    const [trTrainee, setTrTrainee] = useState('');
    const [trTrainer, setTrTrainer] = useState('');
    const [trDate, setTrDate] = useState(today());

    const internalUsers = users.filter(u => u.role !== 'Observador N1' && u.role !== 'Observador N2');

    const save = (patch: Partial<typeof acceptance>) =>
        saveEquipmentAcceptance({ ...acceptance, ...patch } as any).catch(() => { /* toast en el slice */ });

    const addSignoff = () => {
        if (!signDept.trim()) {
            toast.error('Indica el departamento');
            return;
        }
        const user = users.find(u => u.id === signUser);
        const entry: EquipmentSignoff = {
            id: newId(),
            department: signDept.trim(),
            userId: user?.id ?? null,
            userName: user?.name ?? null,
            date: signDate || today()
        };
        save({ signoffs: [...acceptance.signoffs, entry] });
        setSignDept('');
        setSignUser('');
    };

    const addTraining = () => {
        if (!trTrainee.trim() || !trTrainer.trim()) {
            toast.error('Indica receptor e impartidor de la formación');
            return;
        }
        const trainer = users.find(u => u.id === trTrainer);
        const entry: EquipmentTraining = {
            id: newId(),
            trainee: trTrainee.trim(),
            traineeId: null,
            trainer: trainer?.name || trTrainer.trim(),
            trainerId: trainer?.id ?? null,
            date: trDate || today()
        };
        save({ trainings: [...acceptance.trainings, entry] });
        setTrTrainee('');
        setTrTrainer('');
    };

    const removeSignoff = (id: string) =>
        save({ signoffs: acceptance.signoffs.filter(s => s.id !== id) });

    const removeTraining = (id: string) =>
        save({ trainings: acceptance.trainings.filter(t => t.id !== id) });

    // Documentación por categoría
    const docsByCategory = useMemo(() => {
        const groups: Record<string, typeof equipment.documents> = {};
        for (const c of DOCUMENT_CATEGORIES) groups[c] = [];
        groups['Sin categoría'] = [];
        for (const d of equipment.documents || []) {
            const key = d.category && (DOCUMENT_CATEGORIES as readonly string[]).includes(d.category)
                ? d.category : 'Sin categoría';
            groups[key] = [...(groups[key] || []), d];
        }
        return groups;
    }, [equipment.documents]);

    const handlePrint = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        const row = (label: string, value: string) =>
            `<tr><td style="padding:4px 12px;font-weight:bold;vertical-align:top">${label}</td><td style="padding:4px 12px">${value}</td></tr>`;
        const signRows = acceptance.signoffs.map(s =>
            row('Visto bueno', `${s.department} — ${s.userName || '—'} · ${new Date(s.date).toLocaleDateString('es-ES')}`)
        ).join('') || row('Visto bueno', '—');
        const trRows = acceptance.trainings.map(t =>
            row('Formación', `${t.trainee} ← ${t.trainer} · ${new Date(t.date).toLocaleDateString('es-ES')}`)
        ).join('') || row('Formación', '—');
        w.document.write(`
            <html>
              <head>
                <title>Aceptación - ${equipment.name.replace(/[<>]/g, '')}</title>
                <style>
                  body { font-family: sans-serif; padding: 24px; color: #111; }
                  h1 { font-size: 18px; margin: 0 0 4px; }
                  .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
                  table { border-collapse: collapse; width: 100%; margin-top: 12px; }
                  td { border-bottom: 1px solid #ddd; font-size: 12px; }
                  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: bold; border: 1px solid; }
                  .ok { color: #059669; background: #d1fae5; border-color: #6ee7b7; }
                  .ko { color: #94a3b8; background: #f1f5f9; border-color: #dde8f5; }
                </style>
              </head>
              <body>
                <h1>Aceptación de máquina — ${equipment.name.replace(/[<>]/g, '')}</h1>
                <div class="meta">${[equipment.code, equipment.serialNumber, equipment.location].filter(Boolean).join(' · ')}</div>
                <div>
                  Manuales: <span class="badge ${acceptance.manualsOk ? 'ok' : 'ko'}">${acceptance.manualsOk ? 'OK' : 'Pendiente'}</span>
                    Conformidad: <span class="badge ${acceptance.conformityOk ? 'ok' : 'ko'}">${acceptance.conformityOk ? 'OK' : 'Pendiente'}</span>
                </div>
                <table>
                  ${signRows}
                  ${trRows}
                </table>
                <script>window.onload = () => { window.print(); window.close(); }</script>
              </body>
            </html>
        `);
        w.document.close();
    };

    return (
        <div className="space-y-6">
            {/* Resumen: manuales y conformidad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                    { key: 'manualsOk' as const, label: 'Manuales OK' },
                    { key: 'conformityOk' as const, label: 'Documentación de conformidad OK' }
                ]).map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => save({ [key]: !acceptance[key] })}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${acceptance[key]
                            ? 'bg-ok-dim border-ok-border'
                            : 'bg-surface border-line'} ${canEdit ? 'hover:shadow-md' : 'cursor-default'}`}
                    >
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${acceptance[key] ? 'bg-ok border-ok text-white' : 'border-line-2 text-transparent'}`}>
                            <Check size={14} />
                        </span>
                        <span className={`text-sm font-bold ${acceptance[key] ? 'text-ok' : 'text-txt-2'}`}>{label}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-end">
                <button onClick={handlePrint} className="btn btn-ghost btn-sm">
                    <Printer size={14} />
                    Imprimir detalle
                </button>
            </div>

            {/* Vistos buenos */}
            <div className="bg-surface rounded-xl border border-line shadow-sm p-4 space-y-3">
                <h4 className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider">
                    <ClipboardCheck size={14} />
                    Vistos buenos por departamento
                </h4>
                <div className="space-y-1.5">
                    {acceptance.signoffs.map(s => (
                        <div key={s.id} className="flex items-center gap-2 p-2 rounded-[8px] bg-surface-2 border border-line">
                            <Building2 size={13} className="text-txt-3 shrink-0" />
                            <span className="text-sm font-bold text-txt truncate">{s.department}</span>
                            <span className="text-xs text-txt-2 truncate">{s.userName || '—'}</span>
                            <span className="text-xs text-txt-3 ml-auto whitespace-nowrap">
                                {new Date(s.date).toLocaleDateString('es-ES')}
                            </span>
                            {canEdit && (
                                <button onClick={() => removeSignoff(s.id)} className="btn btn-ghost btn-icon shrink-0" title="Quitar">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    {acceptance.signoffs.length === 0 && (
                        <p className="text-xs text-txt-3 italic">Sin vistos buenos registrados.</p>
                    )}
                </div>
                {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            value={signDept}
                            onChange={(e) => setSignDept(e.target.value)}
                            placeholder="Departamento"
                            className="fld-input px-3 py-2 rounded-[6px] outline-none text-sm flex-1 min-w-[140px]"
                        />
                        <select
                            value={signUser}
                            onChange={(e) => setSignUser(e.target.value)}
                            className="fld-input px-3 py-2 rounded-[6px] outline-none text-sm"
                        >
                            <option value="">Usuario (opcional)</option>
                            {internalUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <input
                            type="date"
                            value={signDate}
                            onChange={(e) => setSignDate(e.target.value)}
                            className="fld-input px-3 py-2 rounded-[6px] outline-none text-sm"
                        />
                        <button onClick={addSignoff} className="btn btn-primary btn-sm">
                            <Plus size={13} />
                            Añadir
                        </button>
                    </div>
                )}
            </div>

            {/* Formaciones */}
            <div className="bg-surface rounded-xl border border-line shadow-sm p-4 space-y-3">
                <h4 className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider">
                    <GraduationCap size={14} />
                    Formaciones impartidas
                </h4>
                <div className="space-y-1.5">
                    {acceptance.trainings.map(t => (
                        <div key={t.id} className="flex items-center gap-2 p-2 rounded-[8px] bg-surface-2 border border-line">
                            <GraduationCap size={13} className="text-txt-3 shrink-0" />
                            <span className="text-sm font-bold text-txt truncate">{t.trainee}</span>
                            <span className="text-xs text-txt-2 truncate">← {t.trainer}</span>
                            <span className="text-xs text-txt-3 ml-auto whitespace-nowrap">
                                {new Date(t.date).toLocaleDateString('es-ES')}
                            </span>
                            {canEdit && (
                                <button onClick={() => removeTraining(t.id)} className="btn btn-ghost btn-icon shrink-0" title="Quitar">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    {acceptance.trainings.length === 0 && (
                        <p className="text-xs text-txt-3 italic">Sin formaciones registradas.</p>
                    )}
                </div>
                {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            value={trTrainee}
                            onChange={(e) => setTrTrainee(e.target.value)}
                            placeholder="Receptor de la formación"
                            className="fld-input px-3 py-2 rounded-[6px] outline-none text-sm flex-1 min-w-[140px]"
                        />
                        <select
                            value={trTrainer}
                            onChange={(e) => setTrTrainer(e.target.value)}
                            className="fld-input px-3 py-2 rounded-[6px] outline-none text-sm"
                        >
                            <option value="">Impartido por…</option>
                            {internalUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <input
                            type="date"
                            value={trDate}
                            onChange={(e) => setTrDate(e.target.value)}
                            className="fld-input px-3 py-2 rounded-[6px] outline-none text-sm"
                        />
                        <button onClick={addTraining} className="btn btn-primary btn-sm">
                            <Plus size={13} />
                            Añadir
                        </button>
                    </div>
                )}
            </div>

            {/* Documentación vinculada */}
            <div className="bg-surface rounded-xl border border-line shadow-sm p-4 space-y-3">
                <h4 className="flex items-center gap-2 text-xs font-bold text-txt-3 uppercase tracking-wider">
                    <FileText size={14} />
                    Documentación vinculada
                </h4>
                <div className="flex flex-wrap gap-2">
                    {DOCUMENT_CATEGORIES.map(c => (
                        <span key={c} className={`bdg ${c === 'Manuales' || c === 'Conformidad' ? 'bdg-accent' : 'bdg-gray'}`}>
                            {c}: {docsByCategory[c]?.length || 0}
                        </span>
                    ))}
                </div>
                {(['Manuales', 'Conformidad'] as const).map(cat => (
                    <div key={cat}>
                        <div className="text-xs font-bold text-txt-2 mb-1">{cat}</div>
                        <div className="space-y-1">
                            {(docsByCategory[cat] || []).map(d => (
                                <a
                                    key={d.id}
                                    href={d.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-[8px] bg-surface-2 border border-line hover:bg-surface-3 transition-colors"
                                >
                                    <FileText size={13} className="text-accent shrink-0" />
                                    <span className="text-xs text-txt truncate">{d.name}</span>
                                </a>
                            ))}
                            {(docsByCategory[cat] || []).length === 0 && (
                                <p className="text-[11px] text-txt-3 italic">
                                    Sin documentos de {cat.toLowerCase()} — añádelos en la pestaña Docs.
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
