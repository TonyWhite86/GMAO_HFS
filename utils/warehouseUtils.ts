import { WAREHOUSE_KEYWORDS } from '../constants';

const removeAccents = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const isAlmacenSection = (section: string): boolean => {
    const normalized = removeAccents(section);
    return WAREHOUSE_KEYWORDS.some(kw => normalized.includes(kw));
};

export const userIsInAlmacen = (sections: string[]): boolean => {
    return sections.some(isAlmacenSection);
};
