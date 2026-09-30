/**
 * Canonical identity helpers for the fast-entry flows.
 *
 * The whole system identifies an item by its `name||spec` pair (see the
 * backend balance engine). Entry grids must use the same key so that two rows
 * describing the same item collapse into one, and so a draft can be deduped
 * against what is already on the server.
 */

export function itemKey(name: string, spec?: string | null): string {
  return `${(name ?? '').trim().toLowerCase()}||${(spec ?? '').trim().toLowerCase()}`
}

/** Remove exact duplicates, keeping the first occurrence. */
export function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/** Merge duplicate rows by summing a numeric field (e.g. quantities). */
export function mergeBy<T>(items: T[], key: (item: T) => string, merge: (a: T, b: T) => T): T[] {
  const order: string[] = []
  const map = new Map<string, T>()
  for (const item of items) {
    const k = key(item)
    const existing = map.get(k)
    if (existing) map.set(k, merge(existing, item))
    else {
      map.set(k, item)
      order.push(k)
    }
  }
  return order.map(k => map.get(k)!)
}
