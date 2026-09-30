import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DefaultsContext, type DefaultsContextValue } from './defaults-context'

const PREFIX = 'll_defaults:'

function load(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + 'root') || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function DefaultsProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<Record<string, string>>(load)

  const persist = useCallback((next: Record<string, string>) => {
    setAll(next)
    try {
      localStorage.setItem(PREFIX + 'root', JSON.stringify(next))
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [])

  const value = useMemo<DefaultsContextValue>(
    () => ({
      all,
      get: (key: string) => all[key],
      set: (key: string, v: string) => {
        if (!v) return
        persist({ ...all, [key]: v })
      },
    }),
    [all, persist],
  )

  return <DefaultsContext.Provider value={value}>{children}</DefaultsContext.Provider>
}
