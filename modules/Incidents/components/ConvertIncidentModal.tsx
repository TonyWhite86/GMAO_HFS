import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { X, Check, Wrench, AlertCircle, User as UserIcon, Calendar, ClipboardCheck } from 'lucide-react';
import { Incident, WOType, WOStatus, WOPriority, UserRole } from '../../../types';
import { canBeAssignedToWO } from '../../../utils/incidentVisibility';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { EquipmentSelector } from '../../../components/EquipmentSelector';
import { Modal } from '../../../components/ui/Modal';
import { toast } from 'sonner';

interface ConvertIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
    incident: Incident | null;
}

export const ConvertIncidentModal: React.FC<ConvertIncidentModalProps> = ({ isOpen, onClose, incident }) => {
    const { users, equipment, sections, convertToWorkOrder, currentUser, contractors } = useAppStore();

    const [woData, setWoData] = useState({
        id: '', // Empty to trigger DB sequence
        title: '',
        description: '',
        type: WOType.CORRECTIVE,
        status: WOStatus.SCHEDULED,
        priority: WOPriority.MEDIUM,
        equipmentId: '',
        section: '',
        assignedUserId: '',
        createdBy: '',
        createdAt: new Date().toISOString(),
        isExternal: false,
        contractorId: '',
        externalPrice: '',
    });

    useEffect(() => {
        if (isOpen && incident) {
            setWoData(prev => ({
                ...prev,
                title: incident.title,
                description: incident.description,
                priority: incident.priority,
                equipmentId: incident.equipmentId || '',
                section: incident.section || (sections.length > 0 ? sections[0].name : ''),
                createdBy: currentUser?.id || incident.createdBy,
                id: '' // Important: empty for trigger
            }));
        }
    }, [isOpen, incident, sections, currentUser]);

    if (!isOpen || !incident) return null;

    const handleConvert = async () => {
        if (!woData.section) {
            toast.error('Por favor, asigna una sección a la OT');
            return;
        }
        if (woData.isExternal && !woData.contractorId) {
            toast.error('Una OT externa necesita una contrata');
            return;
        }

        try {
            await convertToWorkOrder(incident.id, {
                ...woData,
                externalPrice: woData.isExternal && woData.externalPrice ? Number(woData.externalPrice) : null
            });
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-spec-dim rounded-lg text-spec"><ClipboardCheck size={22} /></div>}
                subtitle="Convertir"
                subtitleColor="bg-spec-dim text-spec"
            >
                Orden de Trabajo
            </Modal.Header>

            <Modal.Body>
                <div className="bg-accent-dim p-4 rounded-2xl border border-accent-border flex gap-3">
                    <AlertCircle className="text-accent shrink-0" size={20} />
                    <div className="text-xs text-accent leading-relaxed font-medium">
                        Se generará una ID automática tipo OT-YYYY-XXXXXX. Si no asignas responsable, el Jefe de Sección deberá hacerlo luego.
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Type & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-txt-3 uppercase tracking-widest mb-1.5 ml-1">Tipo de OT</label>
                            <CustomSelect
                                value={woData.type}
                                onChange={(val) => setWoData({ ...woData, type: val as WOType })}
                                options={Object.values(WOType).map(v => ({ value: v, label: v }))}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-txt-3 uppercase tracking-widest mb-1.5 ml-1">Prioridad</label>
                            <CustomSelect
                                value={woData.priority}
                                onChange={(val) => setWoData({ ...woData, priority: val as WOPriority })}
                                options={Object.values(WOPriority).map(v => ({ value: v, label: v }))}
                            />
                        </div>
                    </div>

                    {/* Section Selection */}
                    <div>
                        <label className="block text-[10px] font-black text-txt-3 uppercase tracking-widest mb-1.5 ml-1">Sección *</label>
                        <CustomSelect
                            value={woData.section}
                            onChange={(val) => setWoData({ ...woData, section: val })}
                            options={sections.map(s => ({ value: s.name, label: s.name }))}
                        />
                    </div>

                    {/* Trabajo externo */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-txt-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={woData.isExternal}
                                onChange={(e) => setWoData({ ...woData, isExternal: e.target.checked })}
                                className="w-4 h-4"
                            />
                            Trabajo externo (lo realiza una contrata)
                        </label>
                        {woData.isExternal && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-spec-border bg-spec-dim">
                                <div>
                                    <label className="block text-[10px] font-black text-txt-3 uppercase tracking-widest mb-1.5 ml-1">Contrata *</label>
                                    <CustomSelect
                                        value={woData.contractorId}
                                        onChange={(val) => setWoData({ ...woData, contractorId: val })}
                                        options={contractors
                                            .filter(c => c.active)
                                            .map(c => ({ value: c.id, label: c.name }))}
                                        placeholder="Selecciona la contrata…"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-txt-3 uppercase tracking-widest mb-1.5 ml-1">Precio (€)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={woData.externalPrice}
                                        onChange={(e) => setWoData({ ...woData, externalPrice: e.target.value })}
                                        placeholder="0.00"
                                        className="fld-input w-full p-2.5 rounded-[6px] outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Responsible */}
                    <div>
                        <label className="block text-[10px] font-black text-txt-3 uppercase tracking-widest mb-1.5 ml-1">Responsable interno (Opcional, sigue el caso)</label>
                        <CustomSelect
                            value={woData.assignedUserId}
                            onChange={(val) => setWoData({ ...woData, assignedUserId: val })}
                            options={[
                                { value: '', label: 'Dejar sin asignar (asigna Jefe de Sección)' },
                                ...users
                                    .filter(u => canBeAssignedToWO(u, woData.section, [], sections))
                                    .map(u => ({ value: u.id, label: u.name }))
                            ]}
                            placeholder="Asignar a..."
                        />
                    </div>

                    {/* Title & Equipment info (ReadOnly display) */}
                    <div className="grid grid-cols-1 gap-4 p-4 bg-surface-2 rounded-2xl border border-line">
                        <div className="flex gap-2">
                            <div className="text-[10px] font-bold text-txt-3 uppercase w-20">Título:</div>
                            <div className="text-sm font-bold text-txt-2">{woData.title}</div>
                        </div>
                        <div className="flex gap-2">
                            <div className="text-[10px] font-bold text-txt-3 uppercase w-20">Equipo:</div>
                            <div className="text-sm font-medium text-txt-2">
                                {equipment.find(e => e.id === woData.equipmentId)?.name || 'No especificado'}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-txt-2 hover:text-txt-2 text-txt-3 font-bold text-xs transition-colors"
                >
                    CANCELAR
                </button>
                <button
                    onClick={handleConvert}
                    className="px-6 py-2.5 grad-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-spec/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Wrench size={18} />
                    GENERAR Y ASIGNAR ORDEN
                </button>
            </Modal.Footer>
        </Modal>
    );
};
