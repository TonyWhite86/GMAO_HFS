import React, { useState } from 'react';
import { Equipment, EquipmentGroup, EquipmentStoppage, StoppageReasonType, StoppageStatus, User, UserRole } from '../../../types';
import { X, Save, Trash2, Loader2, PlayCircle, CheckCircle2, XCircle, Layers, MapPin, Boxes, Search } from 'lucide-react';
import { expandStoppageScope, StoppageScope } from '../../../utils/stoppageBatch';
import { Modal } from '../../../components/ui/Modal';
import { FormInput } from '../../../components/ui/FormInput';
import { FormTextarea } from '../../../components/ui/FormTextarea';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { EquipmentSelector } from '../../../components/EquipmentSelector';
import { STOPPAGE_REASON_CONFIG, STOPPAGE_STATUS_CONFIG } from '../../../constants';
import { toast } from 'sonner';

interface StoppageFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    stoppage: EquipmentStoppage | null;
    equipment: Equipment[];
    currentUser: User | null;
    canManage: boolean;
    canDelete?: boolean;
    initialEquipmentId?: string;
    initialStartAt?: string;
    linkedWorkOrderId?: string;
    onCreate: (data: Partial<EquipmentStoppage>) => Promise<unknown>;
    /** Lote multi-equipo: N paradas hermanas en una sola operación. */
    onCreateBatch?: (stoppages: Partial<EquipmentStoppage>[]) => Promise<unknown>;
    onUpdate: (id: string, updates: Partial<EquipmentStoppage>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    /** Catálogo de grupos de equipos (para el alcance «Grupo»). */
    groups?: EquipmentGroup[];
    /** Paradas hermanas del lote (para la gestión del lote en detalle). */
    batchSiblings?: EquipmentStoppage[];
}

const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const StoppageFormModal: React.FC<StoppageFormModalProps> = ({
    isOpen, onClose, stoppage, equipment, currentUser, canManage, canDelete = false,
    initialEquipmentId, initialStartAt, linkedWorkOrderId,
    onCreate, onCreateBatch, onUpdate, onDelete,
    groups = [], batchSiblings = []
}) => {
    const [title, setTitle] = useState('');
    const [equipmentId, setEquipmentId] = useState('');
    const [reasonType, setReasonType] = useState<StoppageReasonType>(StoppageReasonType.MAINTENANCE);
    const [startAt, setStartAt] = useState('');
    const [endAt, setEndAt] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Alcance del lote (solo al crear): un equipo, varios, grupo, ubicación o planta
    const [scopeKind, setScopeKind] = useState<StoppageScope['kind']>('single');
    const [multiIds, setMultiIds] = useState<string[]>([]);
    const [multiSearch, setMultiSearch] = useState('');
    const [groupId, setGroupId] = useState('');
    const [location, setLocation] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            setTitle(stoppage?.title || '');
            setEquipmentId(stoppage?.equipmentId || initialEquipmentId || '');
            setReasonType(stoppage?.reasonType || StoppageReasonType.MAINTENANCE);
            setStartAt(toLocalInput(stoppage?.startAt || initialStartAt || new Date().toISOString()));
            const defaultEnd = stoppage?.endAt
                || (initialStartAt ? new Date(new Date(initialStartAt).getTime() + 2 * 3600 * 1000).toISOString() : '');
            setEndAt(toLocalInput(defaultEnd));
            setDescription(stoppage?.description || '');
            setScopeKind('single');
            setMultiIds([]);
            setMultiSearch('');
            setGroupId('');
            setLocation('');
        }
    }, [isOpen, stoppage, initialEquipmentId, initialStartAt]);

    // Ubicaciones distintas del parque (para el alcance «Ubicación»)
    const locations = React.useMemo(
        () => [...new Set(equipment.map(e => e.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
        [equipment]
    );

    // Alcance efectivo + equipos afectados (vista previa)
    const scope: StoppageScope = React.useMemo(() => {
        if (stoppage) return { kind: 'single', equipmentId: stoppage.equipmentId };
        switch (scopeKind) {
            case 'multiple': return { kind: 'multiple', equipmentIds: multiIds };
            case 'group': return { kind: 'group', groupId };
            case 'location': return { kind: 'location', location };
            case 'plant': return { kind: 'plant' };
            default: return { kind: 'single', equipmentId: equipmentId };
        }
    }, [stoppage, scopeKind, multiIds, groupId, location, equipmentId]);

    const affectedIds = React.useMemo(
        () => (scopeKind === 'single' && !stoppage ? [] : expandStoppageScope(equipment, scope, groups)),
        [equipment, scope, groups, scopeKind, stoppage]
    );
    const affectedEquipment = affectedIds.map(id => equipment.find(e => e.id === id)!).filter(Boolean);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !startAt) {
            toast.error('Completa los campos obligatorios');
            return;
        }
        // endAt puede quedar vacío: parada abierta (duración desconocida).
        if (endAt && new Date(endAt) <= new Date(startAt)) {
            toast.error('El fin debe ser posterior al inicio');
            return;
        }
        setIsSubmitting(true);
        try {
            const payload = {
                title: title.trim(),
                reasonType,
                startAt: new Date(startAt).toISOString(),
                endAt: endAt ? new Date(endAt).toISOString() : null,
                description: description.trim() || null
            };
            if (stoppage) {
                await onUpdate(stoppage.id, { ...payload, equipmentId });
                onClose();
                return;
            }
            // Alcance: 1 equipo = parada suelta; varios = lote con batch_id.
            const ids = scopeKind === 'single' ? (equipmentId ? [equipmentId] : []) : affectedIds;
            if (ids.length === 0) {
                toast.error('El alcance no afecta a ningún equipo operativo');
                return;
            }
            const base = {
                ...payload,
                status: StoppageStatus.SCHEDULED,
                requestedBy: currentUser?.id,
                createdBy: currentUser?.id,
                workOrderId: linkedWorkOrderId ?? null
            };
            if (ids.length === 1) {
                await onCreate({ ...base, equipmentId: ids[0] });
            } else {
                if (!onCreateBatch) {
                    toast.error('La creación en lote no está disponible aquí');
                    return;
                }
                const batchId = crypto.randomUUID();
                await onCreateBatch(ids.map(id => ({ ...base, equipmentId: id, batchId })));
            }
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatus = async (status: StoppageStatus) => {
        if (!stoppage) return;
        try {
            await onUpdate(stoppage.id, { status });
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async () => {
        if (!stoppage) return;
        if (!window.confirm(`¿Eliminar la parada "${stoppage.title}"?`)) return;
        try {
            await onDelete(stoppage.id);
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    const statusConfig = stoppage ? STOPPAGE_STATUS_CONFIG[stoppage.status] : null;

    return (
        <Modal onClose={onClose}>
            <Modal.Header onClose={onClose}>
                {stoppage ? 'Detalle de Parada' : 'Nueva Parada Programada'}
            </Modal.Header>

            <Modal.Body>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {stoppage && statusConfig && (
                        <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusConfig.bgClass}`}>
                                {statusConfig.label}
                            </span>
                            {stoppage.requestedByName && (
                                <span className="text-xs text-txt-3">Solicitada por {stoppage.requestedByName}</span>
                            )}
                        </div>
                    )}

                    {/* Parada de lote: hermanas + acciones de conjunto */}
                    {stoppage?.batchId && batchSiblings.length > 0 && (
                        <div className="p-3 rounded-xl border border-spec-border bg-spec-dim">
                            <div className="flex items-center gap-2 mb-2">
                                <Layers size={14} className="text-spec" />
                                <span className="text-xs font-bold text-spec">
                                    Parada de lote · {batchSiblings.length} equipo{batchSiblings.length === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div className="space-y-1 mb-2">
                                {batchSiblings.map(sib => (
                                    <div key={sib.id} className="flex items-center gap-2 text-xs">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${sib.status === StoppageStatus.CANCELLED ? 'bg-txt-3' : sib.status === StoppageStatus.COMPLETED ? 'bg-ok' : sib.status === StoppageStatus.IN_PROGRESS ? 'bg-warn' : 'bg-accent'}`} />
                                        <span className="truncate text-txt-2">{sib.equipmentName || 'Equipo'}</span>
                                        <span className="text-txt-3 ml-auto shrink-0">{STOPPAGE_STATUS_CONFIG[sib.status]?.label}</span>
                                    </div>
                                ))}
                            </div>
                            {canManage && currentUser?.role === UserRole.ADMIN && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const open = batchSiblings.filter(x => x.status !== StoppageStatus.COMPLETED && x.status !== StoppageStatus.CANCELLED);
                                            if (open.length === 0) return;
                                            if (!window.confirm(`¿Cerrar las ${open.length} paradas abiertas del lote?`)) return;
                                            for (const x of open) {
                                                await onUpdate(x.id, { status: StoppageStatus.COMPLETED, endAt: new Date().toISOString() });
                                            }
                                            onClose();
                                        }}
                                        className="px-3 py-1.5 bg-ok text-white rounded-lg text-xs font-bold hover:brightness-110 transition-colors"
                                    >
                                        Cerrar todas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const open = batchSiblings.filter(x => x.status !== StoppageStatus.COMPLETED && x.status !== StoppageStatus.CANCELLED);
                                            if (open.length === 0) return;
                                            if (!window.confirm(`¿Cancelar las ${open.length} paradas abiertas del lote?`)) return;
                                            for (const x of open) {
                                                await onUpdate(x.id, { status: StoppageStatus.CANCELLED });
                                            }
                                            onClose();
                                        }}
                                        className="px-3 py-1.5 bg-surface-3 text-txt rounded-lg text-xs font-bold hover:brightness-110 transition-colors"
                                    >
                                        Cancelar todas
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <FormInput
                        label="Título *"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Cambio de variador en torno 3"
                        required
                        disabled={!canManage}
                    />

                    {stoppage ? (
                        // Edición: la parada ya pertenece a un equipo concreto.
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Equipo *</label>
                            <EquipmentSelector
                                equipment={equipment}
                                selectedId={equipmentId}
                                onSelect={setEquipmentId}
                                placeholder="Selecciona el equipo que se parará..."
                                disabled={!canManage}
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Alcance de la parada *</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {([
                                    ['single', 'Un equipo'],
                                    ['multiple', 'Varios equipos'],
                                    ['group', 'Grupo'],
                                    ['location', 'Ubicación'],
                                    ['plant', 'Toda la planta']
                                ] as [StoppageScope['kind'], string][]).map(([kind, label]) => (
                                    <button
                                        key={kind}
                                        type="button"
                                        onClick={() => setScopeKind(kind)}
                                        disabled={!canManage}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${scopeKind === kind ? 'bg-accent text-white' : 'bg-surface-2 text-txt-2 border border-line hover:bg-surface-3'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {scopeKind === 'single' && (
                                <EquipmentSelector
                                    equipment={equipment}
                                    selectedId={equipmentId}
                                    onSelect={setEquipmentId}
                                    placeholder="Selecciona el equipo que se parará..."
                                    disabled={!canManage}
                                />
                            )}

                            {scopeKind === 'multiple' && (
                                <div className="border border-line rounded-lg bg-surface">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" />
                                        <input
                                            type="text"
                                            value={multiSearch}
                                            onChange={(e) => setMultiSearch(e.target.value)}
                                            placeholder="Buscar equipos..."
                                            className="w-full pl-8 pr-3 py-2 text-sm bg-surface rounded-t-lg outline-none text-txt"
                                        />
                                    </div>
                                    <div className="max-h-44 overflow-y-auto p-1 border-t border-line">
                                        {equipment
                                            .filter(eq => !multiSearch || eq.name.toLowerCase().includes(multiSearch.toLowerCase()))
                                            .map(eq => (
                                                <label key={eq.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-txt-2 hover:bg-surface-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={multiIds.includes(eq.id)}
                                                        disabled={!canManage}
                                                        onChange={() => setMultiIds(prev => prev.includes(eq.id) ? prev.filter(x => x !== eq.id) : [...prev, eq.id])}
                                                        className="rounded border-line-2 text-accent focus:ring-accent"
                                                    />
                                                    <span className="truncate">{eq.name}</span>
                                                    <span className="text-[10px] text-txt-3 ml-auto truncate">{eq.location}</span>
                                                </label>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {scopeKind === 'group' && (
                                <CustomSelect
                                    value={groupId}
                                    onChange={setGroupId}
                                    options={groups.filter(g => g.active).map(g => ({ value: g.id, label: g.name }))}
                                    placeholder="Selecciona el grupo de equipos..."
                                    disabled={!canManage}
                                />
                            )}

                            {scopeKind === 'location' && (
                                <CustomSelect
                                    value={location}
                                    onChange={setLocation}
                                    options={locations.map(l => ({ value: l, label: l }))}
                                    placeholder="Selecciona la ubicación..."
                                    disabled={!canManage}
                                />
                            )}

                            {scopeKind === 'plant' && (
                                <div className="px-4 py-2 rounded-lg border border-line bg-surface-2 text-txt-2 text-sm">
                                    Se pararán <strong>todos los equipos operativos</strong> de la planta.
                                </div>
                            )}

                            {/* Vista previa del alcance */}
                            {scopeKind !== 'single' && (
                                <div className="mt-2 p-2 rounded-lg bg-accent-dim border border-accent-border">
                                    <div className="text-xs font-bold text-accent flex items-center gap-1.5">
                                        <Layers size={12} />
                                        Afecta a {affectedEquipment.length} equipo{affectedEquipment.length === 1 ? '' : 's'}
                                    </div>
                                    {affectedEquipment.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {affectedEquipment.slice(0, 12).map(eq => (
                                                <span key={eq.id} className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-txt-2 border border-line">
                                                    {eq.name}
                                                </span>
                                            ))}
                                            {affectedEquipment.length > 12 && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-txt-3 border border-line">
                                                    +{affectedEquipment.length - 12} más
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {stoppage?.incidentId ? (
                        // El motivo lo aporta la categoría de la incidencia: no se edita aquí.
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Motivo de la parada</label>
                            <div className="w-full px-4 py-2 rounded-lg border border-line bg-surface-2 text-txt-2 text-sm">
                                {stoppage.reasonLabel || '—'}
                                <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-txt-3">de la incidencia</span>
                            </div>
                        </div>
                    ) : (
                        <CustomSelect
                            label="Motivo de la parada *"
                            value={reasonType}
                            onChange={(val) => setReasonType(val as StoppageReasonType)}
                            options={Object.values(StoppageReasonType).map(r => ({
                                value: r,
                                label: STOPPAGE_REASON_CONFIG[r].label
                            }))}
                            disabled={!canManage}
                        />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Inicio *</label>
                            <input
                                type="datetime-local"
                                required
                                value={startAt}
                                onChange={(e) => setStartAt(e.target.value)}
                                disabled={!canManage}
                                className="w-full px-4 py-2 rounded-lg border border-line-2 bg-surface text-txt focus:ring-2 focus:ring-accent outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Fin *</label>
                            <input
                                type="datetime-local"
                                required
                                value={endAt}
                                onChange={(e) => setEndAt(e.target.value)}
                                disabled={!canManage}
                                className="w-full px-4 py-2 rounded-lg border border-line-2 bg-surface text-txt focus:ring-2 focus:ring-accent outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <FormTextarea
                        label="Descripción"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        disabled={!canManage}
                        placeholder="Detalles de la intervención, empresa externa, materiales necesarios..."
                    />

                    {canManage && (
                        <div className="flex justify-between items-center pt-2 border-t border-line">
                            {stoppage && canDelete ? (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="flex items-center gap-2 px-4 py-2 text-ko hover:bg-ko-dim rounded-lg text-sm font-medium transition-colors"
                                    title={stoppage.incidentId ? 'Las paradas de una incidencia no se pueden eliminar' : 'Eliminar parada'}
                                >
                                    <Trash2 size={16} />
                                    Eliminar
                                </button>
                            ) : <span />}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-6 py-2 bg-accent hover:bg-accent-2 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {stoppage ? 'Guardar Cambios' : 'Programar Parada'}
                            </button>
                        </div>
                    )}
                </form>

                {stoppage && canManage && stoppage.status !== StoppageStatus.COMPLETED && stoppage.status !== StoppageStatus.CANCELLED && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {stoppage.status === StoppageStatus.SCHEDULED && (
                            <button
                                onClick={() => handleStatus(StoppageStatus.IN_PROGRESS)}
                                className="flex items-center gap-2 px-4 py-2 bg-warn hover:bg-warn text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                            >
                                <PlayCircle size={16} />
                                Iniciar Parada
                            </button>
                        )}
                        <button
                            onClick={() => handleStatus(StoppageStatus.COMPLETED)}
                            className="flex items-center gap-2 px-4 py-2 bg-ok hover:bg-ok text-white rounded-xl hover:brightness-110 font-bold text-sm transition-all active:scale-95"
                        >
                            <CheckCircle2 size={16} />
                            Completar
                        </button>
                        <button
                            onClick={() => handleStatus(StoppageStatus.CANCELLED)}
                            className="flex items-center gap-2 px-4 py-2 bg-surface-3 hover:bg-surface-3 text-white rounded-xl font-bold text-sm transition-all active:scale-95"
                        >
                            <XCircle size={16} />
                            Cancelar
                        </button>
                    </div>
                )}
            </Modal.Body>

            {!canManage && (
                <Modal.Footer>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-txt-2 font-bold text-sm hover:bg-surface-2 rounded-xl transition-colors flex items-center gap-2"
                    >
                        <X size={16} />
                        Cerrar
                    </button>
                </Modal.Footer>
            )}
        </Modal>
    );
};
