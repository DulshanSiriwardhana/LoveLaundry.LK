import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAppearance } from '../ll-theme'

/* Compatibility layer: the legacy 9-preset settings API now drives the
   unified 20-theme kit. There is exactly one theme owner (ll-theme.tsx). */

export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl'
export type ThemePreset = string

const LEGACY_LIGHT = ['contrast', 'ocean', 'forest', 'sepia', 'slate']
export const DARK_THEMES: ThemePreset[] = ['dark', 'nightblue', 'contrast-dark']
export const isDarkTheme = (t: ThemePreset) =>
  t.startsWith('dark') || DARK_THEMES.includes(t)

interface ThemeSettings {
  fontSize: FontSize
  theme: ThemePreset
  setFontSize: (s: FontSize) => void
  setTheme: (t: ThemePreset) => void
}

const ThemeContext = createContext<ThemeSettings>({
  fontSize: 'md',
  theme: 'light',
  setFontSize: () => {},
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

const FONT_SIZE_MAP: Record<FontSize, string> = {
  xs: '12px', sm: '13px', md: '14px', lg: '15px', xl: '17px', xxl: '19px', xxxl: '22px',
}
const FONT_ZOOM_MAP: Record<FontSize, number> = {
  xs: 0.85, sm: 0.92, md: 1, lg: 1.08, xl: 1.18, xxl: 1.3, xxxl: 1.5,
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme: setUnifiedTheme } = useAppearance()
  const [fontSize, setFontSizeState] = useState<FontSize>(
    () => (localStorage.getItem('theme-font-size') as FontSize) || 'md',
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--body-font-size', FONT_SIZE_MAP[fontSize])
    document.documentElement.style.setProperty('--body-font-zoom', String(FONT_ZOOM_MAP[fontSize]))
  }, [fontSize])

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s)
    localStorage.setItem('theme-font-size', s)
  }

  const setTheme = (t: ThemePreset) => {
    if (t === 'nightblue' || t === 'contrast-dark') setUnifiedTheme('dark')
    else if (LEGACY_LIGHT.includes(t)) setUnifiedTheme('light')
    else setUnifiedTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ fontSize, theme, setFontSize, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
