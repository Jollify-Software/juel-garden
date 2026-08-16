/**
 * Resolve an attribute value that names one or more elements, supporting two
 * conventions rather than guessing between them from a single ambiguous string:
 *
 * - Comma-separated (or a single token): treated as one real CSS selector, e.g.
 *   ".waypoints" or "#wp1, #wp2" -- handed straight to querySelectorAll, so full
 *   selector syntax (including internal spaces, like ".room .waypoint") works.
 * - Space-separated: treated as a list of id/selector *references*, resolved
 *   individually and returned in the order written -- the same convention as
 *   HTML's own space-separated idref attributes (aria-labelledby, aria-owns, ...).
 */
export function resolveElements<T extends Element = Element>(selector: string, root: ParentNode = document): T[] {
    let trimmed = selector.trim();
    if (!trimmed)
        return [];

    if (trimmed.indexOf(',') >= 0) {
        return Array.from(root.querySelectorAll<T>(trimmed));
    }

    if (/\s/.test(trimmed)) {
        return trimmed.split(/\s+/)
            .map(token => root.querySelector<T>(token))
            .filter((el): el is T => el !== null);
    }

    return Array.from(root.querySelectorAll<T>(trimmed));
}
