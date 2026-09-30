/**
 * Response-shape guards for list endpoints.
 *
 * The API is free to omit collections: a list endpoint can answer `null`
 * instead of `[]`, and an individual row can come back without its `items`
 * array. The declared types claim both are always present, so a missing
 * array reaches a render as `null.items` and takes the whole page down with
 * it rather than degrading to an empty list.
 *
 * Normalising here keeps those types honest for every consumer, instead of
 * relying on each page to remember a `?? []` at every single access.
 */

/** Coerces a list response to a real array, dropping any null rows. */
export function asList<T>(data: readonly (T | null | undefined)[] | null | undefined): T[] {
    return Array.isArray(data) ? data.filter((row): row is T => row != null) : []
}

/** As `asList`, and guarantees `items` is an array on every row. */
export function withItems<T extends { items?: unknown }>(data: T[] | null | undefined): T[] {
    return asList(data).map((row) => ({
        ...row,
        items: Array.isArray(row.items) ? row.items : [],
    }))
}

/**
 * Recursively replaces every `items` value in a response with a real array.
 *
 * `withItems` only covers the top level of a list, but the API nests the
 * collection: a `/reports/client-wise` row carries `items` and also a
 * `gate_passes[]` whose own rows carry `items`. Those inner rows are the ones
 * that reach a render unguarded, so a single top-level pass leaves the same
 * `null.items` crash in place. Depth is capped so a self-referential payload
 * cannot spin here.
 *
 * Null *entries* inside a collection are dropped for the same reason a null row
 * is dropped at the top level: a null line carries no quantity, so it cannot
 * affect a balance, but `items.map(i => i.item_name)` throws on it. Dropping
 * it removes a crash without inventing or altering any real figure.
 */
const NESTED_KEYS = ['items', 'gate_passes', 'rows', 'results', 'data'] as const

export function withNestedItems<T>(value: T, depth = 0): T {
    if (depth > 6 || value == null || typeof value !== 'object') return value
    if (Array.isArray(value)) {
        return value
            .filter((row) => row != null)
            .map((row) => withNestedItems(row, depth + 1)) as unknown as T
    }
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
    for (const key of NESTED_KEYS) {
        const child = out[key]
        if (Array.isArray(child)) {
            out[key] = child.filter((row) => row != null).map((row) => withNestedItems(row, depth + 1))
        } else if (child == null && key === 'items') {
            out[key] = []
        }
    }
    return out as T
}

/** `asList` plus the nested `items` repair, for a list response. */
export function normaliseList<T>(data: T[] | null | undefined): T[] {
    return withNestedItems(asList(data))
}
