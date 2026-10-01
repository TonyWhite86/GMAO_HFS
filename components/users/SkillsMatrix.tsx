import React, { useState, useEffect } from 'react';
import { User, Skill, UserSkill } from '../../types';
import { skillsService } from '../../services/skillsService';
import { toast } from 'sonner';
import { RefreshCw, LayoutGrid, Info } from 'lucide-react';

interface SkillsMatrixProps {
    users: User[];
    refreshTrigger: number; // Increment to force reload
}

export const SkillsMatrix: React.FC<SkillsMatrixProps> = ({ users, refreshTrigger }) => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null); // "userId-skillId"

    // Filter only relevant users (Technical staff)
    const technicalRoles = ['Responsable Sección', 'Técnico', 'Observador N1', 'Observador N2'];
    const matrixUsers = users.filter(u => technicalRoles.includes(u.role) && u.active);

    useEffect(() => {
        loadData();
    }, [refreshTrigger]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [skillsData, userSkillsData] = await Promise.all([
                skillsService.getSkills(),
                skillsService.getAllUserSkills()
            ]);
            setSkills(skillsData);
            setUserSkills(userSkillsData);
        } catch (error) {
            toast.error('Error al cargar la matriz');
        } finally {
            setLoading(false);
        }
    };

    const getSkillLevel = (userId: string, skillId: string) => {
        const entry = userSkills.find(us => us.userId === userId && us.skillId === skillId);
        return entry ? entry.level : 0;
    };

    const handleLevelChange = async (userId: string, skillId: string, transform: (current: number) => number) => {
        const currentKey = `${userId}-${skillId}`;
        if (updating === currentKey) return;

        const currentLevel = getSkillLevel(userId, skillId);
        const newLevel = transform(currentLevel);

        // Optimistic update
        const previousUserSkills = [...userSkills];
        setUserSkills(prev => {
            const existingInfo = prev.find(us => us.userId === userId && us.skillId === skillId);
            if (existingInfo) {
                return prev.map(us => us.id === existingInfo.id ? { ...us, level: newLevel } : us);
            } else {
                return [...prev, { id: 'temp', userId, skillId, level: newLevel, createdAt: '' }];
            }
        });

        setUpdating(currentKey);
        try {
            const updatedEntry = await skillsService.updateUserSkill(userId, skillId, newLevel);
            // Replace temp/old entry with server data
            setUserSkills(prev => {
                const others = prev.filter(us => !(us.userId === userId && us.skillId === skillId));
                return [...others, updatedEntry];
            });
        } catch (error) {
            // Revert on error
            setUserSkills(previousUserSkills);
            toast.error('Error al actualizar nivel');
        } finally {
            setUpdating(null);
        }
    };

    // Group skills by category
    const skillsByCategory = skills.reduce((acc, skill) => {
        if (!acc[skill.category]) acc[skill.category] = [];
        acc[skill.category].push(skill);
        return acc;
    }, {} as Record<string, Skill[]>);

    if (loading && skills.length === 0) {
        return <div className="p-8 text-center text-slate-500">Cargando matriz...</div>;
    }

    if (skills.length === 0) {
        return <div className="p-8 text-center text-slate-500">No hay habilidades definidas. Crea algunas primero.</div>;
    }

    return (
        <div className="overflow-x-auto pb-6">
            <div className="min-w-max">
                <table className="border-collapse w-full">
                    <thead>
                        {/* Category Header */}
                        <tr>
                            <th className="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 sticky left-0 z-20 min-w-[200px]"></th>
                            {Object.entries(skillsByCategory).map(([category, catSkills]) => (
                                <th
                                    key={category}
                                    colSpan={catSkills.length}
                                    className="p-2 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-center text-xs font-bold uppercase text-slate-600 dark:text-slate-300"
                                >
                                    {category}
                                </th>
                            ))}
                        </tr>
                        {/* Skill Header */}
                        <tr>
                            <th className="p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 sticky left-0 z-20 text-left font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <LayoutGrid size={16} />
                                    Técnico
                                </div>
                            </th>
                            {skills.map(skill => (
                                <th
                                    key={skill.id}
                                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 min-w-[100px] text-center"
                                    title={skill.description}
                                >
                                    <div className="flex flex-col items-center">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap px-2">{skill.name}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrixUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 sticky left-0 z-10 font-medium text-sm text-slate-800 dark:text-slate-200 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs">
                                            {user.name.charAt(0)}
                                        </div>
                                        {user.name}
                                    </div>
                                </td>
                                {skills.map(skill => {
                                    const level = getSkillLevel(user.id, skill.id);
                                    // Color scale for levels
                                    const getBgColor = (lvl: number) => {
                                        if (lvl === 0) return 'bg-slate-100 dark:bg-slate-700/50';
                                        if (lvl === 1) return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
                                        if (lvl === 2) return 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
                                        if (lvl === 3) return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
                                        if (lvl === 4) return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
                                        if (lvl === 5) return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold';
                                        return '';
                                    };

                                    return (
                                        <td
                                            key={skill.id}
                                            className="p-1 border border-slate-200 dark:border-slate-800 text-center relative"
                                        >
                                            <button
                                                onClick={() => handleLevelChange(user.id, skill.id, (prev) => prev >= 5 ? 0 : prev + 1)}
                                                className={`w-full h-10 rounded-lg flex items-center justify-center text-sm transition-all sm:hover:opacity-80 active:scale-95 ${getBgColor(level)}`}
                                                title={`Nivel ${level}/5 - Clic para cambiar`}
                                            >
                                                {level > 0 ? level : '-'}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex gap-4 text-xs text-slate-500 justify-end px-4">
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 rounded"></span> 1: Aprendiz</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-100 rounded"></span> 2: Básico</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 rounded"></span> 3: Autónomo</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 rounded"></span> 4: Avanzado</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-100 rounded"></span> 5: Experto</div>
            </div>
        </div>
    );
};
