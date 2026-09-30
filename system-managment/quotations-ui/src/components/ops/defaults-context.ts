import { createContext, useContext } from 'react'

/**
 * Remembers the last value the user picked for a field (client, receiver,
 * category, …) so the next entry pre-fills it. This is the single biggest
 * typing saver in the daily entry flows.
 */
export interface DefaultsContextValue {
  all: Record<string, string>
  get: (key: string) => string | undefined
  set: (key: string, value: string) => void
}

export const DefaultsContext = createContext<DefaultsContextValue | null>(null)

export function useDefaults(): DefaultsContextValue {
  const ctx = useContext(DefaultsContext)
  if (!ctx) throw new Error('useDefaults must be used within a DefaultsProvider')
  return ctx
}
