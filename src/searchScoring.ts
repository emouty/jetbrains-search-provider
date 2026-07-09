/**
 * Pure search-scoring helpers, shared by the providers and precomputed on
 * JetBrainsProject so names are normalized once at load time instead of on
 * every keystroke.
 */

/**
 * Normalize a name for matching: collapse any separator (-, _, space, .)
 * into a single space. This lets "server archiver" (two GNOME terms)
 * match "server-archiver".
 */
export function normalizeForSearch(s: string): string {
    return s.toLowerCase().replace(/[-_\s.]+/g, ' ').trim();
}

/**
 * Normalize a filesystem path for matching: like normalizeForSearch but also
 * collapses path separators, so "work/backend" → "work backend".
 */
export function normalizePathForSearch(path: string): string {
    return path.toLowerCase().replace(/[-_\s./]+/g, ' ').trim();
}

/**
 * Calculate a search score for a project.
 *
 * All inputs must already be normalized (see normalizeForSearch /
 * normalizePathForSearch).
 *
 * Scores by match quality:
 * - 1000: Exact match (project name equals search term)
 * - 900: Search term is a complete word in the project name
 * - 800: Search term starts a word in the project name
 * - 500: Search term appears at the start of the project name
 * - 100: Search term appears anywhere in the project name
 * - 50: Search term appears only in the project path
 * - 0: No match
 */
export function calculateSearchScore(normalizedName: string, normalizedPath: string, normalizedTerm: string): number {
    if (normalizedName.includes(normalizedTerm)) {
        if (normalizedName === normalizedTerm) return 1000;
        const nameParts = normalizedName.split(' ');
        if (nameParts.includes(normalizedTerm)) return 900;
        if (nameParts.some(p => p.startsWith(normalizedTerm))) return 800;
        if (normalizedName.startsWith(normalizedTerm)) return 500;
        return 100;
    }

    // Path match: lower score so name matches always rank higher.
    if (normalizedPath.includes(normalizedTerm)) return 50;

    return 0;
}
