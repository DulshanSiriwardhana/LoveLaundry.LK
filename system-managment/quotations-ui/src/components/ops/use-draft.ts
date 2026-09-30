import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'll_draft:'

/**
 * Persist an in-progress entry form to localStorage so a refresh, navigation
 * or accidental close never loses work. `clear()` is called once the draft has
 * been committed to the server.
 */
export function useDraft<T extends object>(key: string, initial: T) {
  const storageKey = PREFIX + key
  const initialRef = useRef(initial)

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) return { ...initialRef.current, ...(JSON.parse(raw) as Partial<T>) }
    } catch {
      // ignore corrupt or unreadable drafts
    }
    return initial
  })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) return
    try {
      if (JSON.stringify(value) === JSON.stringify(initialRef.current)) {
        localStorage.removeItem(storageKey)
      } else {
        localStorage.setItem(storageKey, JSON.stringify(value))
      }
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [value, dirty, storageKey])

  const set = useCallback((patch: Partial<T> | ((prev: T) => T)) => {
    setDirty(true)
    setValue(prev =>
      typeof patch === 'function' ? (patch as (p: T) => T)(prev) : { ...prev, ...patch },
    )
  }, [])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    setValue(initialRef.current)
    setDirty(false)
  }, [storageKey])

  return { value, set, clear, dirty }
}

/** Returns true when a saved draft exists for the given key. */
export function hasDraft(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) !== null
  } catch {
    return false
  }
}
