/** Active cache scope (the logged-in user's id, sanitized). */

let scope = 'anon'

export function setCacheScope(next: string): void {
  scope = next || 'anon'
}

export function getCacheScope(): string {
  return scope
}