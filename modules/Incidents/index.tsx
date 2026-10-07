import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Incident, IncidentStatus, Section } from '../../types';
import { Plus, Search, Filter } from 'lucide-react';
import { IncidentList } from './components/IncidentList';
import { IncidentDetail } from './components/IncidentDetail';
import { CreateIncidentModal } from './components/CreateIncidentModal';
import { useSearchFilter } from '../../hooks/useSearchFilter';
import { useVisibleCategories } from '../../hooks/useVisibleCategories';
import { canSeeIncident } from '../../utils/incidentVisibility';
import { PageHeader } from '../../components/ui/PageHeader';





import { CustomSelect } from '../../components/ui/CustomSelect';

export const IncidentsModule: React.FC = () => {
    const { incidents, incidentCategories, currentUser, sections } = useAppStore();
    const visibleCategories = useVisibleCategories(currentUser);
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // 1. Security Filtering (espejo de incident_visible_to_me en RLS:
    //    sección de la incidencia + visibilidad de categoría + comodín/observador)
    const searchableIncidents = React.useMemo(() => {
        return incidents.filter(inc =>
            canSeeIncident(inc, currentUser, incidentCategories, sections as Section[])
        );
    }, [incidents, currentUser, incidentCategories, sections]);

    // 2. Functional Filtering (Search & Status)
    const {
        searchTerm,
        setSearchTerm,
        filters,
        setFilter,
        filteredData: filteredIncidents
    } = useSearchFilter<Incident>({
        data: searchableIncidents,
        searchFields: ['title', 'description']
    });

    const statusFilter = filters.status || 'ALL';
    const categoryFilter = filters.categoryId || 'ALL';

    // Solo se puede abrir el detalle de una incidencia visible para el usuario
    const selectedIncident = searchableIncidents.find(i => i.id === selectedIncidentId) || null;

    const statusOptions = [
        { value: 'ALL', label: 'Todas las incidencias' },
        ...Object.values(IncidentStatus).map(status => ({
            value: status,
            label: status
        }))
    ];

    const categoryOptions = [
        { value: 'ALL', label: 'Todas las categorías' },
        ...visibleCategories.filter(c => c.isActive).map(c => ({
            value: c.id,
            label: c.name
        }))
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
            {/* Header */}
            <div className="flex-none p-4 md:p-6 pb-0 mb-4">
                <PageHeader
                    title="Centro de Incidencias"
                    subtitle="Reporta y sigue el estado de las averías y anomalías."
                    actions={
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <Plus size={20} />
                            Reportar Incidencia
                        </button>
                    }
                />
            </div>

            {/* Filters */}
            <div className="flex-none px-4 md:px-6 mb-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-slate-700 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="relative flex-1 w-full flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar incidencias..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
                            />
                        </div>
                        <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />
                    </div>
                    
                    <div className="w-full sm:w-56">
                        <CustomSelect
                            value={categoryFilter}
                            onChange={(value) => setFilter('categoryId', value)}
                            options={categoryOptions}
                            placeholder="Filtrar por categoría"
                            className="w-full"
                        />
                    </div>

                    <div className="w-full sm:w-56">
                        <CustomSelect
                            value={statusFilter}
                            onChange={(value) => setFilter('status', value)}
                            options={statusOptions}
                            placeholder="Filtrar por estado"
                            className="w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
                <IncidentList
                    incidents={filteredIncidents}
                    selectedId={selectedIncidentId}
                    onSelect={setSelectedIncidentId}
                />
            </div>

            {/* Modals */}
            {isCreateModalOpen && (
                <CreateIncidentModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                />
            )}

            {selectedIncidentId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-700 w-full h-full md:max-w-4xl md:h-[90vh] md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col">
                        <IncidentDetail
                            incident={selectedIncident}
                            onClose={() => setSelectedIncidentId(null)}
                            onNavigateToWorkOrder={(woId) => {
                                setSelectedIncidentId(null);
                                useAppStore.getState().setActiveModule('maintenance');
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
