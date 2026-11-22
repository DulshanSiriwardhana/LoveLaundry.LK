import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   LOVE LAUNDRY — UNIFIED THEME KIT
   ───────────────────────────────────────────────────────────────────────────
   Two appearance modes: light and dark. Preference persists in localStorage
   and is applied to <html data-theme> before first paint via THEME_INIT_SCRIPT.
   Zero runtime dependencies; icons are inline SVG using currentColor so they
   inherit the five-colour palette.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Appearance = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'lovelaundry-theme';

/** Inline this in <head> before stylesheets to eliminate theme flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t;r.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;

function readAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable — fall through to system preference */
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyAppearance(value: Appearance) {
  const root = document.documentElement;
  root.setAttribute('data-theme', value);
  root.style.colorScheme = value;
  root.classList.toggle('dark', value === 'dark');
}

interface ThemeContextValue {
  appearance: Appearance;
  isDark: boolean;
  setAppearance: (value: Appearance) => void;
  toggleAppearance: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  appearance: 'light',
  isDark: false,
  setAppearance: () => {},
  toggleAppearance: () => {},
});

export function useAppearance(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Legacy alias used by apps that already call useTheme(). */
export const useTheme = useAppearance;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try { stored = localStorage.getItem(THEME_STORAGE_KEY); } catch { /* ignore */ }
      if (stored !== 'light' && stored !== 'dark') {
        setAppearanceState(event.matches ? 'dark' : 'light');
      }
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const setAppearance = useCallback((value: Appearance) => {
    setAppearanceState(value);
    try { localStorage.setItem(THEME_STORAGE_KEY, value); } catch { /* ignore */ }
    applyAppearance(value);
  }, []);

  const toggleAppearance = useCallback(() => {
    setAppearance(readAppearance() === 'dark' ? 'light' : 'dark');
  }, [setAppearance]);

  const value = useMemo<ThemeContextValue>(
    () => ({ appearance, isDark: appearance === 'dark', setAppearance, toggleAppearance }),
    [appearance, setAppearance, toggleAppearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export interface ThemeSwitcherProps {
  className?: string;
  compact?: boolean;
}

/** Professional, accessible light/dark switcher. */
export function ThemeSwitcher({ className = '', compact = false }: ThemeSwitcherProps) {
  const { appearance, isDark, toggleAppearance } = useAppearance();
  return (
    <button
      type="button"
      onClick={toggleAppearance}
      className={`ll-theme-switcher ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 0 : 8,
        minWidth: compact ? 38 : 96,
        height: 38,
        padding: compact ? 0 : '0 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-2)',
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 600,
        transition: 'background var(--duration-fast), border-color var(--duration-fast)',
      }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
      {!compact && <span>{appearance === 'dark' ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
