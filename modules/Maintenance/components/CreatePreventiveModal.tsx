import React, { useState, useEffect } from 'react';
import { PreventivePlan, Equipment, User, SubTask, UserRole, Section } from '../../../types';
import { PlanTargetsPicker } from './PlanTargetsPicker';
import { useAppStore } from '../../../store/useAppStore';
import { PlanTargetsInput, expandTargetEquipment } from '../../../utils/preventiveTargets';
import { ListPlus, Plus, Check, User as UserIcon, Trash2, PlayCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { VoiceInputButton } from '../../../components/ui/VoiceInputButton';
import { Modal } from '../../../components/ui/Modal';
import { toast } from 'sonner';

interface CreatePreventiveModalProps {
    onClose: () => void;
    onSubmit: (plan: PreventivePlan, launchNow?: boolean, targets?: PlanTargetsInput) => void;
    equipment: Equipment[];
    users: User[];
    currentUser: User;
    editingPlan?: PreventivePlan;
    readOnly?: boolean;
    sections: Section[];
}

export const CreatePreventiveModal: React.FC<CreatePreventiveModalProps> = ({
    onClose,
    onSubmit,
    equipment,
    users,
    currentUser,
    editingPlan,
    readOnly,
    sections
}) => {
    const { equipmentGroups } = useAppStore();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [staggerDays, setStaggerDays] = useState(0);
    const [frequency, setFrequency] = useState<number>(30);
    const [newTask, setNewTask] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('');
    const [tasks, setTasks] = useState<SubTask[]>([]);
    const [launchNow, setLaunchNow] = useState(false);
    const [section, setSection] = useState('');

    useEffect(() => {
        if (editingPlan) {
            setName(editingPlan.name);
            setDescription(editingPlan.description || '');
            setFrequency(editingPlan.frequencyDays);
            setTasks(editingPlan.tasks);
            setSection(editingPlan.section || '');
            const targets = editingPlan.targets || [];
            setSelectedEquipment(targets.filter(t => !t.sourceGroupId).map(t => t.equipmentId));
            setSelectedGroups([...new Set(targets.map(t => t.sourceGroupId).filter(Boolean))] as string[]);
        }
    }, [editingPlan]);

    // Sección por defecto según el primer equipo seleccionado
    useEffect(() => {
        if (selectedEquipment.length > 0 && !section && !editingPlan) {
            const eq = equipment.find(e => e.id === selectedEquipment[0]);
            if (eq && eq.sections && eq.sections.length > 0) {
                setSection(eq.sections[0]);
            }
        }
    }, [selectedEquipment, equipment, section, editingPlan]);


    const handleAddTask = () => {
        if (newTask.trim()) {
            const task: SubTask = {
                id: crypto.randomUUID(),
                description: newTask.trim(),
                completed: false,
                assignedUserIds: newTaskAssignee ? [newTaskAssignee] : []
            };
            setTasks([...tasks, task]);
            setNewTask('');
            setNewTaskAssignee('');
        }
    };

    const removeTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const toggleTaskCompleted = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        const hasTargets = selectedEquipment.length > 0 || selectedGroups.length > 0;
        if (!name || !hasTargets || tasks.length === 0 || !section) {
            if (!name) toast.error('El nombre del plan es obligatorio');
            else if (!hasTargets) toast.error('Selecciona al menos un equipo o grupo');
            else if (!section) toast.error('Debes seleccionar una sección');
            else if (tasks.length === 0) toast.error('Debes añadir al menos una tarea');
            return;
        }

        const plan: PreventivePlan = {
            id: editingPlan ? editingPlan.id : crypto.randomUUID(),
            name,
            description,
            frequencyDays: isNaN(frequency) ? 30 : frequency,
            tasks,
            nextRun: editingPlan ? editingPlan.nextRun : new Date().toISOString(),
            section
        };
        const targets: PlanTargetsInput = {
            equipmentIds: selectedEquipment,
            groupIds: selectedGroups,
            staggerDays
        };
        onSubmit(plan, launchNow, targets);
    };

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-accent-dim rounded-lg text-accent"><PlayCircle size={22} /></div>}
                subtitle="Recurrente"
                subtitleColor="bg-accent-dim text-accent"
            >
                {readOnly ? 'Detalles del Plan Preventivo' : (editingPlan ? 'Editar Plan Preventivo' : 'Nuevo Plan Preventivo')}
            </Modal.Header>

            <Modal.Body>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-txt-2 mb-1">Nombre del Plan {readOnly ? '' : '*'}</label>
                        <input
                            type="text"
                            required
                            disabled={readOnly}
                            className={`w-full ${readOnly ? 'p-0 bg-transparent border-none text-lg font-bold' : 'p-3 border border-line rounded-xl bg-surface'} text-txt focus:ring-2 focus:ring-spec outline-none disabled:opacity-100`}
                            placeholder="Ej. Revisión Mensual de Compresor"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-txt-2">Descripción del Plan</label>
                            {!readOnly && (
                                <VoiceInputButton
                                    onTranscript={text => setDescription(prev => prev ? `${prev} ${text}` : text)}
                                />
                            )}
                        </div>
                        <textarea
                            disabled={readOnly}
                            className={`w-full ${readOnly ? 'p-0 bg-transparent border-none' : 'p-3 border border-line rounded-xl bg-surface'} text-txt focus:ring-2 focus:ring-spec outline-none disabled:opacity-100 resize-none h-auto min-h-[50px]`}
                            placeholder="Detalles adicionales sobre el procedimiento..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Equipos objetivo (sueltos y/o grupos) */}
                    <PlanTargetsPicker
                        equipment={equipment}
                        groups={equipmentGroups}
                        selectedEquipment={selectedEquipment}
                        selectedGroups={selectedGroups}
                        staggerDays={staggerDays}
                        disabled={readOnly}
                        onEquipmentChange={setSelectedEquipment}
                        onGroupsChange={setSelectedGroups}
                        onStaggerChange={setStaggerDays}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Section */}
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Sección de Trabajo *</label>
                            {readOnly ? (
                                <div className="text-txt font-medium py-2 font-semibold">
                                    {section || 'Sin asignar'}
                                </div>
                            ) : (
                                <select
                                    required
                                    className="w-full p-3 border border-line rounded-xl bg-surface text-txt focus:ring-2 focus:ring-spec outline-none"
                                    value={section}
                                    onChange={e => setSection(e.target.value)}
                                >
                                    <option value="" disabled>Selecciona sección...</option>
                                    {sections.map(s => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Frequency */}
                        <div>
                            <label className="block text-sm font-medium text-txt-2 mb-1">Periodicidad (Días) *</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    disabled={readOnly}
                                    className={`w-full ${readOnly ? 'p-0 text-left bg-transparent border-none' : 'p-3 pr-24 border border-line rounded-xl bg-surface'} text-base font-bold text-txt focus:ring-2 focus:ring-spec outline-none disabled:opacity-100 no-spinner transition-all`}
                                    value={isNaN(frequency) ? '' : frequency}
                                    onChange={e => setFrequency(e.target.value === '' ? NaN : parseInt(e.target.value))}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                    <span className="text-sm font-bold text-txt-3 select-none">días</span>
                                    {!readOnly && (
                                        <div className="flex flex-col border-l border-line pl-2">
                                            <button
                                                type="button"
                                                onClick={() => setFrequency(f => (isNaN(f) ? 1 : f) + 1)}
                                                className="p-0.5 text-txt-3 hover:text-spec transition-colors"
                                                title="Aumentar"
                                            >
                                                <ChevronUp size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFrequency(f => Math.max(1, (isNaN(f) ? 1 : f) - 1))}
                                                className="p-0.5 text-txt-3 hover:text-spec transition-colors"
                                                title="Disminuir"
                                            >
                                                <ChevronDown size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tasks */}
                    <div>
                        <label className="block text-sm font-medium text-txt-2 mb-2 flex items-center gap-2">
                            <ListPlus size={16} /> Acciones a realizar *
                        </label>

                        {!readOnly && (
                            <div className="bg-surface-2 p-4 rounded-xl border border-line/60 shadow-inner mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-7">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full p-2 pr-24 border border-line rounded-xl bg-surface text-txt focus:ring-2 focus:ring-spec outline-none"
                                                placeholder="Descripción de la tarea..."
                                                value={newTask}
                                                onChange={e => setNewTask(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTask())}
                                            />
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                                <VoiceInputButton
                                                    onTranscript={(text) => setNewTask(prev => prev ? prev + ' ' + text : text)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <select
                                            className="w-full p-2 border border-line rounded-xl bg-surface text-txt focus:ring-2 focus:ring-spec outline-none"
                                            value={newTaskAssignee}
                                            onChange={e => setNewTaskAssignee(e.target.value)}
                                        >
                                            <option value="">Sin asignar</option>
                                            {users
                                                .filter(u => u.role !== UserRole.OBSERVER_L1 && u.role !== UserRole.OBSERVER_L2)
                                                .map(u => (
                                                    <option key={u.id} value={u.id}>{u.name}</option>
                                                ))}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <button
                                            type="button"
                                            onClick={handleAddTask}
                                            disabled={!newTask.trim()}
                                            className="px-2 py-2 bg-spec hover:bg-spec text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Plus size={20} /> Añadir
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {tasks.length > 0 ? (
                                tasks.map((task, idx) => (
                                    <div key={task.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${task.completed ? 'bg-ok-dim border-ok-border' : 'bg-surface border-line group hover:border-accent-border'}`}>
                                        <div className="flex items-center gap-4 flex-1">
                                            {/* Checkbox for visual consistency */}
                                            <button
                                                type="button"
                                                onClick={() => !readOnly && toggleTaskCompleted(task.id)}
                                                disabled={readOnly}
                                                className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed
                                                    ? 'bg-ok border-ok text-white'
                                                    : 'bg-surface border-line text-transparent hover:border-spec'
                                                    } ${readOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                                            >
                                                <Check size={16} strokeWidth={3} />
                                            </button>

                                            <div className="flex-1">
                                                <p className={`text-sm font-medium ${task.completed ? 'text-txt-2 line-through' : 'text-txt-2'}`}>
                                                    {task.description}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-1.5 font-mono">
                                                    {task.assignedUserIds?.map(uid => {
                                                        const user = users.find(u => u.id === uid);
                                                        return user ? (
                                                            <div key={uid} className="flex items-center gap-1.5 text-[10px] uppercase font-bold bg-surface-2 px-2 py-1 rounded-full border border-line/50 text-txt-2">
                                                                <UserIcon size={10} />
                                                                <span>{user.name.split(' ')[0]}</span>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={() => removeTask(task.id)}
                                                className="p-2 text-txt-3 hover:text-ko hover:bg-ko-dim rounded-full transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 rounded-2xl border-2 border-dashed border-line text-txt-3 text-sm">
                                    <ListPlus size={32} className="mx-auto mb-3 opacity-20" />
                                    <span>No hay tareas de mantenimiento definidas para este plan.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Launch Now Checkbox (Only for Create Mode) */}
                    {!editingPlan && !readOnly && (
                        <div className="bg-surface-2 p-4 rounded-xl border border-line flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-accent-dim rounded-lg text-accent">
                                    <PlayCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-txt">Lanzar primera orden ahora</p>
                                    <p className="text-xs text-txt-2">Se generará la primera orden de trabajo inmediatamente al crear el plan.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLaunchNow(!launchNow)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${launchNow ? 'bg-accent' : 'bg-surface-3 bg-surface'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${launchNow ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    )}
                </form>
            </Modal.Body>

            {!readOnly && (
                <Modal.Footer>
                    <button type="button" onClick={onClose} className="btn btn-ghost">
                        Cancelar
                    </button>
                    <button type="button" onClick={handleSubmit} className="btn btn-primary px-6">
                        {editingPlan ? 'Guardar Cambios' : 'Crear Plan'}
                    </button>
                </Modal.Footer>
            )}
        </Modal>
    );
};
