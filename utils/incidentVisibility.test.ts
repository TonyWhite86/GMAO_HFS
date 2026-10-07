import { describe, it, expect } from 'vitest';
import {
    canViewIncidentCategory,
    canSeeIncident,
    canManageIncident,
    isObserver,
    isWildcardUser
} from './incidentVisibility';
import { IncidentCategory, Section, User, UserRole } from '../types';

const baseUser = {
    id: 'u1', name: 'Ana', email: 'a@a.com',
    role: UserRole.TECHNICIAN, sections: ['Mecanizado'], active: true
} as User;

const cat = (visibleSections: string[], visibleRoles: string[]) => ({
    visibleSections, visibleRoles
});

const catalog = (id: string, visibleSections: string[] = [], visibleRoles: string[] = []) => ({
    id, visibleSections, visibleRoles
}) as Pick<IncidentCategory, 'id' | 'visibleSections' | 'visibleRoles'>;

const sections = (over: Partial<Section>[] = []): Pick<Section, 'name' | 'isWildcard'>[] => ([
    { name: 'Mecanizado', isWildcard: false },
    { name: 'Calidad', isWildcard: false },
    { name: 'Mantenimiento', isWildcard: true },
    { name: 'Ingeniería', isWildcard: true },
    ...over.map(s => ({ name: s.name!, isWildcard: s.isWildcard! }))
]);

describe('canViewIncidentCategory', () => {
    it('el Admin ve todo', () => {
        const admin = { ...baseUser, role: UserRole.ADMIN, sections: [] };
        expect(canViewIncidentCategory(cat(['Calidad'], ['Observador N1']), admin)).toBe(true);
    });

    it('sin usuario no hay acceso', () => {
        expect(canViewIncidentCategory(cat([], []), null)).toBe(false);
    });

    it('listas vacías = visible para todos', () => {
        expect(canViewIncidentCategory(cat([], []), baseUser)).toBe(true);
    });

    it('categoría ausente = visible', () => {
        expect(canViewIncidentCategory(null, baseUser)).toBe(true);
    });

    it('acceso por sección', () => {
        expect(canViewIncidentCategory(cat(['Mecanizado'], []), baseUser)).toBe(true);
        expect(canViewIncidentCategory(cat(['Calidad'], []), baseUser)).toBe(false);
    });

    it('acceso por rol', () => {
        expect(canViewIncidentCategory(cat([], ['Técnico']), baseUser)).toBe(true);
        expect(canViewIncidentCategory(cat([], ['Observador N2']), baseUser)).toBe(false);
    });

    it('sección o rol bastan', () => {
        expect(canViewIncidentCategory(cat(['Calidad'], ['Técnico']), baseUser)).toBe(true);
        expect(canViewIncidentCategory(cat(['Calidad'], ['Observador N1']), baseUser)).toBe(false);
    });
});

describe('isObserver', () => {
    it('detecta Observador N1 y N2', () => {
        expect(isObserver({ role: UserRole.OBSERVER_L1 })).toBe(true);
        expect(isObserver({ role: UserRole.OBSERVER_L2 })).toBe(true);
    });

    it('no es observador el resto de roles', () => {
        expect(isObserver({ role: UserRole.ADMIN })).toBe(false);
        expect(isObserver({ role: UserRole.TECHNICIAN })).toBe(false);
        expect(isObserver({ role: UserRole.SECTION_MANAGER })).toBe(false);
        expect(isObserver(null)).toBe(false);
    });
});

describe('isWildcardUser', () => {
    it('un usuario de sección comodín es comodín', () => {
        const u = { role: UserRole.TECHNICIAN, sections: ['Mantenimiento'] };
        expect(isWildcardUser(u, sections())).toBe(true);
    });

    it('Ingeniería también es comodín', () => {
        const u = { role: UserRole.SECTION_MANAGER, sections: ['Ingeniería'] };
        expect(isWildcardUser(u, sections())).toBe(true);
    });

    it('una sección normal no es comodín', () => {
        expect(isWildcardUser(baseUser, sections())).toBe(false);
    });

    it('un observador NUNCA es comodín aunque esté en Mantenimiento', () => {
        const u = { role: UserRole.OBSERVER_L1, sections: ['Mantenimiento', 'Ingeniería'] };
        expect(isWildcardUser(u, sections())).toBe(false);
    });

    it('sin secciones en el catálogo no hay comodines', () => {
        const u = { role: UserRole.TECHNICIAN, sections: ['Mantenimiento'] };
        expect(isWildcardUser(u, [])).toBe(false);
        expect(isWildcardUser(u, undefined)).toBe(false);
    });
});

describe('canSeeIncident', () => {
    const all = sections();

    it('sin usuario no hay acceso', () => {
        expect(canSeeIncident({ section: '', categoryId: null }, null, [], all)).toBe(false);
    });

    it('el Admin ve todo', () => {
        const admin = { role: UserRole.ADMIN, sections: [] } as User;
        expect(canSeeIncident({ section: 'Calidad', categoryId: 'c-restringida' },
            admin, [catalog('c-restringida', ['Calidad'], [])], all)).toBe(true);
    });

    it('incidencia sin sección la ve todo el mundo', () => {
        const otro = { role: UserRole.TECHNICIAN, sections: ['Calidad'] } as User;
        expect(canSeeIncident({ section: '', categoryId: null }, baseUser, [], all)).toBe(true);
        expect(canSeeIncident({ section: null, categoryId: null }, baseUser, [], all)).toBe(true);
        expect(canSeeIncident({ section: '', categoryId: null }, otro, [], all)).toBe(true);
    });

    it("incidencia con sección 'Global' la ve todo el mundo", () => {
        const otro = { role: UserRole.TECHNICIAN, sections: ['Calidad'] } as User;
        expect(canSeeIncident({ section: 'Global', categoryId: null }, otro, [], all)).toBe(true);
    });

    it('incidencia acotada a una sección solo la ve esa sección', () => {
        const mio = { role: UserRole.TECHNICIAN, sections: ['Mecanizado'] } as User;
        const otro = { role: UserRole.TECHNICIAN, sections: ['Calidad'] } as User;
        expect(canSeeIncident({ section: 'Mecanizado', categoryId: null }, mio, [], all)).toBe(true);
        expect(canSeeIncident({ section: 'Mecanizado', categoryId: null }, otro, [], all)).toBe(false);
    });

    it('el comodín ve y gestiona incidencias de cualquier sección', () => {
        const mant = { role: UserRole.TECHNICIAN, sections: ['Mantenimiento'] } as User;
        const ing = { role: UserRole.SECTION_MANAGER, sections: ['Ingeniería'] } as User;
        expect(canSeeIncident({ section: 'Mecanizado', categoryId: null }, mant, [], all)).toBe(true);
        expect(canSeeIncident({ section: 'Calidad', categoryId: 'c-oculta' },
            ing, [catalog('c-oculta', ['Otra'], [])], all)).toBe(true);
    });

    it('el comodín NO aplica a observadores', () => {
        const obs = { role: UserRole.OBSERVER_L1, sections: ['Mantenimiento'] } as User;
        expect(canSeeIncident({ section: 'Mecanizado', categoryId: null }, obs, [], all)).toBe(false);
    });

    it('las dos capas son un Y lógico: pasa sección pero no categoría', () => {
        const u = { role: UserRole.TECHNICIAN, sections: ['Mecanizado'] } as User;
        const cats = [catalog('c1', ['Calidad'], [])];
        // sección OK (vacía) pero categoría restringida a Calidad
        expect(canSeeIncident({ section: '', categoryId: 'c1' }, u, cats, all)).toBe(false);
        // sección OK (Mecanizado) pero categoría restringida a Calidad
        expect(canSeeIncident({ section: 'Mecanizado', categoryId: 'c1' }, u, cats, all)).toBe(false);
    });

    it('las dos capas pasan conjuntamente', () => {
        const u = { role: UserRole.TECHNICIAN, sections: ['Mecanizado'] } as User;
        const cats = [catalog('c1', ['Mecanizado'], [])];
        expect(canSeeIncident({ section: 'Mecanizado', categoryId: 'c1' }, u, cats, all)).toBe(true);
    });

    it('la capa categoría se salta con el rol correcto', () => {
        const u = { role: UserRole.OBSERVER_L2, sections: ['Mecanizado'] } as User;
        const cats = [catalog('c1', [], ['Observador N2'])];
        expect(canSeeIncident({ section: '', categoryId: 'c1' }, u, cats, all)).toBe(true);
    });
});

describe('canManageIncident', () => {
    const all = sections();
    const sinSeccion = { section: '', categoryId: null };

    it('el Admin gestiona todo', () => {
        const admin = { role: UserRole.ADMIN, sections: [] } as User;
        expect(canManageIncident(sinSeccion, admin, [], all)).toBe(true);
    });

    it('el Responsable Sección gestiona lo que ve', () => {
        const resp = { role: UserRole.SECTION_MANAGER, sections: ['Mecanizado'] } as User;
        const otro = { role: UserRole.SECTION_MANAGER, sections: ['Calidad'] } as User;
        expect(canManageIncident({ section: 'Mecanizado', categoryId: null }, resp, [], all)).toBe(true);
        expect(canManageIncident({ section: 'Mecanizado', categoryId: null }, otro, [], all)).toBe(false);
    });

    it('el Técnico NO gestiona salvo que sea comodín', () => {
        const tech = { role: UserRole.TECHNICIAN, sections: ['Mecanizado'] } as User;
        const mant = { role: UserRole.TECHNICIAN, sections: ['Mantenimiento'] } as User;
        expect(canManageIncident(sinSeccion, tech, [], all)).toBe(false);
        expect(canManageIncident(sinSeccion, mant, [], all)).toBe(true);
    });

    it('el observador nunca gestiona', () => {
        const obs = { role: UserRole.OBSERVER_L1, sections: ['Mantenimiento', 'Mecanizado'] } as User;
        expect(canManageIncident(sinSeccion, obs, [], all)).toBe(false);
    });
});
