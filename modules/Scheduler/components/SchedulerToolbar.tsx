import React from 'react';
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, LayoutGrid, BarChart3 } from 'lucide-react';
import { Section, WOType, WOPriority } from '../../../types';

interface SchedulerToolbarProps {
    isMobile: boolean;
    canViewGrid: boolean;
    isSectionManager: boolean;
    viewMode: 'day' | 'week';
    onViewModeChange: (mode: 'day' | 'week') => void;
    activeTab: 'programacion' | 'parte';
    onTabChange: (tab: 'programacion' | 'parte') => void;
    sections: Section[];
    selectedSection: string;
    onSectionChange: (value: string) => void;
    filterType: string;
    onTypeChange: (value: string) => void;
    filterPriority: string;
    onPriorityChange: (value: string) => void;
    showSunday: boolean;
    onToggleSunday: () => void;
    headerLabel: string;
    onNavigate: (direction: 'prev' | 'next') => void;
    onToday: () => void;
}

export const SchedulerToolbar: React.FC<SchedulerToolbarProps> = ({
    isMobile,
    canViewGrid,
    isSectionManager,
    viewMode,
    onViewModeChange,
    activeTab,
    onTabChange,
    sections,
    selectedSection,
    onSectionChange,
    filterType,
    onTypeChange,
    filterPriority,
    onPriorityChange,
    showSunday,
    onToggleSunday,
    headerLabel,
    onNavigate,
    onToday
}) => {
    const selectClass = "h-9 px-3 rounded-md text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="flex flex-col xl:flex-row flex-wrap justify-between items-center gap-3 bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 justify-center">
                {!isMobile && (
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 h-9">
                        <button
                            onClick={() => onViewModeChange('day')}
                            className={`px-3 h-full rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <LayoutGrid size={15} />
                            Día
                        </button>
                        <button
                            onClick={() => onViewModeChange('week')}
                            className={`px-3 h-full rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <CalendarDays size={15} />
                            Semana
                        </button>
                    </div>
                )}

                {/* Tab selector */}
                {canViewGrid && !isMobile && (
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 h-9">
                        <button
                            onClick={() => onTabChange('programacion')}
                            className={`px-3 h-full rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${activeTab === 'programacion' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <LayoutGrid size={15} />
                            Programación
                        </button>
                        <button
                            onClick={() => onTabChange('parte')}
                            className={`px-3 h-full rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${activeTab === 'parte' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <BarChart3 size={15} />
                            Parte
                        </button>
                    </div>
                )}

                {/* Section Filter - HIDE for Section Managers (they are auto-filtered) */}
                {!isSectionManager && (
                    <select
                        id="scheduler-section-filter"
                        name="sectionFilter"
                        aria-label="Filtrar por sección"
                        value={selectedSection}
                        onChange={(e) => onSectionChange(e.target.value)}
                        className={selectClass}
                    >
                        <option value="">Todas las secciones</option>
                        {sections.map(section => (
                            <option key={section.id} value={section.name}>{section.name}</option>
                        ))}
                    </select>
                )}

                {/* Type Filter */}
                <select
                    id="scheduler-type-filter"
                    name="typeFilter"
                    aria-label="Filtrar por tipo"
                    value={filterType}
                    onChange={(e) => onTypeChange(e.target.value)}
                    className={selectClass}
                >
                    <option value="">Todos los tipos</option>
                    {Object.values(WOType).map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>

                {/* Priority Filter */}
                <select
                    id="scheduler-priority-filter"
                    name="priorityFilter"
                    aria-label="Filtrar por prioridad"
                    value={filterPriority}
                    onChange={(e) => onPriorityChange(e.target.value)}
                    className={selectClass}
                >
                    <option value="">Todas las prioridades</option>
                    {Object.values(WOPriority).map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>

                {/* Sunday Toggle */}
                {viewMode === 'week' && (
                    <button
                        onClick={onToggleSunday}
                        className={`flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${showSunday ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' : 'bg-transparent text-slate-500 border-slate-200 dark:border-slate-700'}`}
                        title={showSunday ? "Ocultar Domingo" : "Mostrar Domingo"}
                    >
                        {showSunday ? <Eye size={15} /> : <EyeOff size={15} />}
                        Domingo
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                    onClick={onToday}
                    className="hidden sm:flex items-center gap-1.5 h-9 px-3 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 transition-colors shadow-sm"
                >
                    <CalendarCheck size={15} />
                    Hoy
                </button>

                <button onClick={() => onNavigate('prev')} className="h-9 w-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300">
                    <ChevronLeft size={18} />
                </button>
                <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize min-w-[200px] text-center text-sm whitespace-nowrap">
                    {headerLabel}
                </span>
                <button onClick={() => onNavigate('next')} className="h-9 w-9 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-600 dark:text-slate-300">
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
};
