import React, { useState, useEffect } from 'react';
import { PreventivePlan, Equipment, User, SubTask, UserRole, Section } from '../../../types';
import { EquipmentSelector } from '../../../components/EquipmentSelector';
import { ListPlus, Plus, Check, User as UserIcon, Trash2, PlayCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { VoiceInputButton } from '../../../components/ui/VoiceInputButton';
import { Modal } from '../../../components/ui/Modal';
import { toast } from 'sonner';

interface CreatePreventiveModalProps {
    onClose: () => void;
    onSubmit: (plan: PreventivePlan, launchNow?: boolean) => void;
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
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [equipmentId, setEquipmentId] = useState('');
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
            setEquipmentId(editingPlan.equipmentId);
            setFrequency(editingPlan.frequencyDays);
            setTasks(editingPlan.tasks);
            setSection(editingPlan.section || '');
        } else {
            // Set default equipment if available
            if (equipment.length > 0 && !equipmentId) {
                setEquipmentId(equipment[0].id);
            }
        }
    }, [editingPlan, equipment]);

    // Defensive check to ensure equipmentId is set if not already
    useEffect(() => {
        if (!equipmentId && equipment.length > 0) {
            setEquipmentId(equipment[0].id);
        }
    }, [equipment]);

    // Set default section based on equipment selected
    useEffect(() => {
        if (equipmentId && !section && !editingPlan) {
            const eq = equipment.find(e => e.id === equipmentId);
            if (eq && eq.sections && eq.sections.length > 0) {
                setSection(eq.sections[0]);
            }
        }
    }, [equipmentId, equipment, section, editingPlan]);


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
        if (!name || !equipmentId || tasks.length === 0 || !section) {
            if (!name) toast.error('El nombre del plan es obligatorio');
            else if (!equipmentId) toast.error('Debes seleccionar un equipo');
            else if (!section) toast.error('Debes seleccionar una sección');
            else if (tasks.length === 0) toast.error('Debes añadir al menos una tarea');
            return;
        }

        const plan: PreventivePlan = {
            id: editingPlan ? editingPlan.id : crypto.randomUUID(),
            name,
            description,
            equipmentId,
            frequencyDays: isNaN(frequency) ? 30 : frequency,
            tasks,
            nextRun: editingPlan ? editingPlan.nextRun : new Date().toISOString(),
            section
        };
        onSubmit(plan, launchNow);
    };

    return (
        <Modal onClose={onClose} size="lg">
            <Modal.Header
                onClose={onClose}
                icon={<div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400"><PlayCircle size={22} /></div>}
                subtitle="Recurrente"
                subtitleColor="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
                {readOnly ? 'Detalles del Plan Preventivo' : (editingPlan ? 'Editar Plan Preventivo' : 'Nuevo Plan Preventivo')}
            </Modal.Header>

            <Modal.Body>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Nombre del Plan {readOnly ? '' : '*'}</label>
                        <input
                            type="text"
                            required
                            disabled={readOnly}
                            className={`w-full ${readOnly ? 'p-0 bg-transparent border-none text-lg font-bold' : 'p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700'} text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-100`}
                            placeholder="Ej. Revisión Mensual de Compresor"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Descripción del Plan</label>
                            {!readOnly && (
                                <VoiceInputButton
                                    onTranscript={text => setDescription(prev => prev ? `${prev} ${text}` : text)}
                                />
                            )}
                        </div>
                        <textarea
                            disabled={readOnly}
                            className={`w-full ${readOnly ? 'p-0 bg-transparent border-none' : 'p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700'} text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-100 resize-none h-auto min-h-[50px]`}
                            placeholder="Detalles adicionales sobre el procedimiento..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Equipment */}
                        <div className={readOnly ? 'pointer-events-none' : ''}>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Equipo / Activo {readOnly ? '' : '*'}</label>
                            {readOnly ? (
                                <div className="text-slate-900 dark:text-white font-medium py-2">
                                    {equipment.find(e => e.id === equipmentId)?.name}
                                </div>
                            ) : (
                                <EquipmentSelector
                                    equipment={equipment}
                                    selectedId={equipmentId}
                                    onSelect={setEquipmentId}
                                    required
                                    color="purple"
                                />
                            )}
                        </div>

                        {/* Section */}
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Sección de Trabajo *</label>
                            {readOnly ? (
                                <div className="text-slate-900 dark:text-white font-medium py-2 font-semibold">
                                    {section || 'Sin asignar'}
                                </div>
                            ) : (
                                <select
                                    required
                                    className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
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
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Periodicidad (Días) *</label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    disabled={readOnly}
                                    className={`w-full ${readOnly ? 'p-0 text-left bg-transparent border-none' : 'p-3 pr-24 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700'} text-base font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-100 no-spinner transition-all`}
                                    value={isNaN(frequency) ? '' : frequency}
                                    onChange={e => setFrequency(e.target.value === '' ? NaN : parseInt(e.target.value))}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-400 select-none">días</span>
                                    {!readOnly && (
                                        <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-2">
                                            <button
                                                type="button"
                                                onClick={() => setFrequency(f => (isNaN(f) ? 1 : f) + 1)}
                                                className="p-0.5 text-slate-400 hover:text-purple-500 transition-colors"
                                                title="Aumentar"
                                            >
                                                <ChevronUp size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFrequency(f => Math.max(1, (isNaN(f) ? 1 : f) - 1))}
                                                className="p-0.5 text-slate-400 hover:text-purple-500 transition-colors"
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
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <ListPlus size={16} /> Acciones a realizar *
                        </label>

                        {!readOnly && (
                            <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-800/60 shadow-inner mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-7">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="w-full p-2 pr-24 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
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
                                            className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
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
                                            className="px-2 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
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
                                    <div key={task.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${task.completed ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/40' : 'bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-700 group hover:border-purple-300'}`}>
                                        <div className="flex items-center gap-4 flex-1">
                                            {/* Checkbox for visual consistency */}
                                            <button
                                                type="button"
                                                onClick={() => !readOnly && toggleTaskCompleted(task.id)}
                                                disabled={readOnly}
                                                className={`flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent hover:border-purple-400'
                                                    } ${readOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                                            >
                                                <Check size={16} strokeWidth={3} />
                                            </button>

                                            <div className="flex-1">
                                                <p className={`text-sm font-medium ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                                                    {task.description}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-1.5 font-mono">
                                                    {task.assignedUserIds?.map(uid => {
                                                        const user = users.find(u => u.id === uid);
                                                        return user ? (
                                                            <div key={uid} className="flex items-center gap-1.5 text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600/50 text-slate-500 dark:text-slate-400">
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
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
                                    <ListPlus size={32} className="mx-auto mb-3 opacity-20" />
                                    <span>No hay tareas de mantenimiento definidas para este plan.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Launch Now Checkbox (Only for Create Mode) */}
                    {!editingPlan && !readOnly && (
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 dark:text-purple-400">
                                    <PlayCircle size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">Lanzar primera orden ahora</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Se generará la primera orden de trabajo inmediatamente al crear el plan.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLaunchNow(!launchNow)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${launchNow ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${launchNow ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    )}
                </form>
            </Modal.Body>

            {!readOnly && (
                <Modal.Footer>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20"
                    >
                        {editingPlan ? 'Guardar Cambios' : 'Crear Plan'}
                    </button>
                </Modal.Footer>
            )}
        </Modal>
    );
};
