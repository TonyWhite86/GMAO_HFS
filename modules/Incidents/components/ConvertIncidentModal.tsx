import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { X, Check, Wrench, AlertCircle, User as UserIcon, Calendar, ClipboardCheck } from 'lucide-react';
import { Incident, WOType, WOStatus, WOPriority, UserRole } from '../../../types';
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
    const { users, equipment, sections, convertToWorkOrder, currentUser } = useAppStore();

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

        try {
            await convertToWorkOrder(incident.id, woData);
            onClose();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400"><ClipboardCheck size={22} /></div>}
                subtitle="Convertir"
                subtitleColor="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
                Orden de Trabajo
            </Modal.Header>

            <Modal.Body>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex gap-3">
                    <AlertCircle className="text-blue-500 shrink-0" size={20} />
                    <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                        Se generará una ID automática tipo OT-YYYY-XXXXXX. Si no asignas responsable, el Jefe de Sección deberá hacerlo luego.
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Type & Priority */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tipo de OT</label>
                            <CustomSelect
                                value={woData.type}
                                onChange={(val) => setWoData({ ...woData, type: val as WOType })}
                                options={Object.values(WOType).map(v => ({ value: v, label: v }))}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Prioridad</label>
                            <CustomSelect
                                value={woData.priority}
                                onChange={(val) => setWoData({ ...woData, priority: val as WOPriority })}
                                options={Object.values(WOPriority).map(v => ({ value: v, label: v }))}
                            />
                        </div>
                    </div>

                    {/* Section Selection */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Sección *</label>
                        <CustomSelect
                            value={woData.section}
                            onChange={(val) => setWoData({ ...woData, section: val })}
                            options={sections.map(s => ({ value: s.name, label: s.name }))}
                        />
                    </div>

                    {/* Responsible */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Responsable OT (Opcional)</label>
                        <CustomSelect
                            value={woData.assignedUserId}
                            onChange={(val) => setWoData({ ...woData, assignedUserId: val })}
                            options={[
                                { value: '', label: 'Dejar sin asignar (asigna Jefe de Sección)' },
                                ...users
                                    .filter(u => u.role !== UserRole.OBSERVER_L1 && u.role !== UserRole.OBSERVER_L2 && (!woData.section || u.sections.includes(woData.section)))
                                    .map(u => ({ value: u.id, label: u.name }))
                            ]}
                            placeholder="Asignar a..."
                        />
                    </div>

                    {/* Title & Equipment info (ReadOnly display) */}
                    <div className="grid grid-cols-1 gap-4 p-4 bg-slate-100 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div className="flex gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase w-20">Título:</div>
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{woData.title}</div>
                        </div>
                        <div className="flex gap-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase w-20">Equipo:</div>
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                {equipment.find(e => e.id === woData.equipmentId)?.name || 'No especificado'}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal.Body>

            <Modal.Footer>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-xs transition-colors"
                >
                    CANCELAR
                </button>
                <button
                    onClick={handleConvert}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Wrench size={18} />
                    GENERAR Y ASIGNAR ORDEN
                </button>
            </Modal.Footer>
        </Modal>
    );
};
