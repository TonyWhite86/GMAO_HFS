
/**
 * Normalizes a string for search purposes:
 * 1. Convert to lowercase
 * 2. Remove accents/diacritics
 * 3. Remove specified special characters (like question marks)
 * @param str The string to normalize
 * @returns The normalized string
 */
export const normalizeForSearch = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[?¿!¡,.|]/g, "")       // Remove specified special characters
        .trim();
};
