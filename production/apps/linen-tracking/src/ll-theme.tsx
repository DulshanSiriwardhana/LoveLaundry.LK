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
   LOVE LAUNDRY — UNIFIED THEME KIT / STANDARD
   ───────────────────────────────────────────────────────────────────────────
   40 selectable themes. Each preset pins a surface and an accent; body
   text is always the opposite pole of that surface, and accent controls carry
   a computed on-accent colour. WCAG AA (>= 4.5:1) is verified by the generator.
   Preference persists in localStorage and is applied to <html data-theme>
   before first paint via THEME_INIT_SCRIPT. Zero dependencies.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ThemeOption {
  id: string;
  label: string;
  mode: 'light' | 'dark';
  swatch: string;
  background: string;
}

export const THEMES: readonly ThemeOption[] = [
  { id: 'light', label: 'Graphite Light', mode: 'light', swatch: '#27272A', background: '#F5F5F4' },
  { id: 'dark', label: 'Graphite Dark', mode: 'dark', swatch: '#E4E4E7', background: '#0B0B0C' },
  { id: 'light-crimson', label: 'Crimson Light', mode: 'light', swatch: '#BE123C', background: '#F5F5F4' },
  { id: 'dark-crimson', label: 'Crimson Dark', mode: 'dark', swatch: '#FB7185', background: '#0B0B0C' },
  { id: 'light-ember', label: 'Ember Light', mode: 'light', swatch: '#C2410C', background: '#F5F5F4' },
  { id: 'dark-ember', label: 'Ember Dark', mode: 'dark', swatch: '#FB923C', background: '#0B0B0C' },
  { id: 'light-amber', label: 'Amber Light', mode: 'light', swatch: '#A16207', background: '#F5F5F4' },
  { id: 'dark-amber', label: 'Amber Dark', mode: 'dark', swatch: '#FBBF24', background: '#0B0B0C' },
  { id: 'light-gold', label: 'Gold Light', mode: 'light', swatch: '#854D0E', background: '#F5F5F4' },
  { id: 'dark-gold', label: 'Gold Dark', mode: 'dark', swatch: '#FCD34D', background: '#0B0B0C' },
  { id: 'light-lime', label: 'Lime Light', mode: 'light', swatch: '#4D7C0F', background: '#F5F5F4' },
  { id: 'dark-lime', label: 'Lime Dark', mode: 'dark', swatch: '#A3E635', background: '#0B0B0C' },
  { id: 'light-emerald', label: 'Emerald Light', mode: 'light', swatch: '#047857', background: '#F5F5F4' },
  { id: 'dark-emerald', label: 'Emerald Dark', mode: 'dark', swatch: '#34D399', background: '#0B0B0C' },
  { id: 'light-forest', label: 'Forest Light', mode: 'light', swatch: '#166534', background: '#F5F5F4' },
  { id: 'dark-forest', label: 'Forest Dark', mode: 'dark', swatch: '#4ADE80', background: '#0B0B0C' },
  { id: 'light-teal', label: 'Teal Light', mode: 'light', swatch: '#0F766E', background: '#F5F5F4' },
  { id: 'dark-teal', label: 'Teal Dark', mode: 'dark', swatch: '#2DD4BF', background: '#0B0B0C' },
  { id: 'light-rose', label: 'Rose Light', mode: 'light', swatch: '#BE185D', background: '#F5F5F4' },
  { id: 'dark-rose', label: 'Rose Dark', mode: 'dark', swatch: '#F472B6', background: '#0B0B0C' },
  { id: 'light-magenta', label: 'Magenta Light', mode: 'light', swatch: '#A21CAF', background: '#F5F5F4' },
  { id: 'dark-magenta', label: 'Magenta Dark', mode: 'dark', swatch: '#E879F9', background: '#0B0B0C' },
  { id: 'light-plum', label: 'Plum Light', mode: 'light', swatch: '#7E22CE', background: '#F5F5F4' },
  { id: 'dark-plum', label: 'Plum Dark', mode: 'dark', swatch: '#C084FC', background: '#0B0B0C' },
  { id: 'light-violet', label: 'Violet Light', mode: 'light', swatch: '#6D28D9', background: '#F5F5F4' },
  { id: 'dark-violet', label: 'Violet Dark', mode: 'dark', swatch: '#A78BFA', background: '#0B0B0C' },
  { id: 'light-indigo', label: 'Indigo Light', mode: 'light', swatch: '#4338CA', background: '#F5F5F4' },
  { id: 'dark-indigo', label: 'Indigo Dark', mode: 'dark', swatch: '#818CF8', background: '#0B0B0C' },
  { id: 'light-cobalt', label: 'Cobalt Light', mode: 'light', swatch: '#1D4ED8', background: '#F5F5F4' },
  { id: 'dark-cobalt', label: 'Cobalt Dark', mode: 'dark', swatch: '#60A5FA', background: '#0B0B0C' },
  { id: 'light-azure', label: 'Azure Light', mode: 'light', swatch: '#0369A1', background: '#F5F5F4' },
  { id: 'dark-azure', label: 'Azure Dark', mode: 'dark', swatch: '#38BDF8', background: '#0B0B0C' },
  { id: 'light-cyan', label: 'Cyan Light', mode: 'light', swatch: '#0E7490', background: '#F5F5F4' },
  { id: 'dark-cyan', label: 'Cyan Dark', mode: 'dark', swatch: '#22D3EE', background: '#0B0B0C' },
  { id: 'light-slate', label: 'Slate Light', mode: 'light', swatch: '#334155', background: '#F5F5F4' },
  { id: 'dark-slate', label: 'Slate Dark', mode: 'dark', swatch: '#CBD5E1', background: '#0B0B0C' },
  { id: 'light-sand', label: 'Sand Light', mode: 'light', swatch: '#78716C', background: '#F5F5F4' },
  { id: 'dark-sand', label: 'Sand Dark', mode: 'dark', swatch: '#D6D3D1', background: '#0B0B0C' },
  { id: 'light-olive', label: 'Olive Light', mode: 'light', swatch: '#3F6212', background: '#F5F5F4' },
  { id: 'dark-olive', label: 'Olive Dark', mode: 'dark', swatch: '#BEF264', background: '#0B0B0C' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type Appearance = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'lovelaundry-theme';
const LEGACY_KEY = 'theme-preset';
const DARK_LEGACY = ['dark', 'nightblue', 'contrast-dark'];
const IDS: readonly string[] = THEMES.map(t => t.id);
const BY_ID = new Map(THEMES.map(t => [t.id, t] as const));

/** Inline this in <head> before stylesheets to eliminate theme flash. */
export const THEME_INIT_SCRIPT = `(function(){try{
var ids=['light','dark','light-crimson','dark-crimson','light-ember','dark-ember','light-amber','dark-amber','light-gold','dark-gold','light-lime','dark-lime','light-emerald','dark-emerald','light-forest','dark-forest','light-teal','dark-teal','light-rose','dark-rose','light-magenta','dark-magenta','light-plum','dark-plum','light-violet','dark-violet','light-indigo','dark-indigo','light-cobalt','dark-cobalt','light-azure','dark-azure','light-cyan','dark-cyan','light-slate','dark-slate','light-sand','dark-sand','light-olive','dark-olive'];
var t=localStorage.getItem('${THEME_STORAGE_KEY}');
if(ids.indexOf(t)<0){
  var legacy=localStorage.getItem('${LEGACY_KEY}');
  if(legacy==='dark'||legacy==='nightblue'||legacy==='contrast-dark'){t='dark';}
  else if(legacy==='light'||legacy==='contrast'||legacy==='ocean'||legacy==='forest'||legacy==='sepia'||legacy==='slate'){t='light';}
  else{t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}
}
var mode=t.indexOf('dark')===0?'dark':'light';
var r=document.documentElement;
r.setAttribute('data-theme',t);r.style.colorScheme=mode;r.classList.toggle('dark',mode==='dark');
}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;

const modeOf = (id: string): Appearance => BY_ID.get(id)?.mode ?? 'light';

function systemTheme(): ThemeId {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function readTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && IDS.indexOf(stored) >= 0) return stored as ThemeId;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      if (DARK_LEGACY.indexOf(legacy) >= 0) return 'dark';
      if (['light', 'contrast', 'ocean', 'forest', 'sepia', 'slate'].indexOf(legacy) >= 0) return 'light';
    }
  } catch {
    /* storage unavailable — fall through to system preference */
  }
  return systemTheme();
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  const mode = modeOf(id);
  root.setAttribute('data-theme', id);
  root.style.colorScheme = mode;
  root.classList.toggle('dark', mode === 'dark');
}

interface ThemeContextValue {
  theme: ThemeId;
  appearance: Appearance;
  isDark: boolean;
  setTheme: (value: ThemeId) => void;
  setAppearance: (value: Appearance) => void;
  toggleAppearance: () => void;
}

const fallback: ThemeContextValue = {
  theme: 'light',
  appearance: 'light',
  isDark: false,
  setTheme: () => {},
  setAppearance: () => {},
  toggleAppearance: () => {},
};

const ThemeContext = createContext<ThemeContextValue>(fallback);

export function useAppearance(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Legacy alias used by apps that already call useTheme(). */
export const useTheme = useAppearance;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = (event: MediaQueryListEvent) => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored || IDS.indexOf(stored) < 0) stored = localStorage.getItem(LEGACY_KEY);
      } catch { /* ignore */ }
      if (!stored || IDS.indexOf(stored) < 0) setThemeState(event.matches ? 'dark' : 'light');
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  const setTheme = useCallback((value: ThemeId) => {
    if (IDS.indexOf(value) < 0) return;
    setThemeState(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
      localStorage.removeItem(LEGACY_KEY);
    } catch { /* ignore */ }
    applyTheme(value);
  }, []);

  const setAppearance = useCallback((value: Appearance) => setTheme(value), [setTheme]);

  const toggleAppearance = useCallback(() => {
    setTheme(modeOf(readTheme()) === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, appearance: modeOf(theme), isDark: modeOf(theme) === 'dark', setTheme, setAppearance, toggleAppearance }),
    [theme, setTheme, setAppearance, toggleAppearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

export interface ThemeSwitcherProps {
  className?: string;
  compact?: boolean;
}

/** Accessible theme picker: every preset is a native option with a swatch. */
export function ThemeSwitcher({ className = '', compact = false }: ThemeSwitcherProps) {
  const { theme, setTheme } = useAppearance();
  const current = BY_ID.get(theme);
  return (
    <label className={`ll-theme-switcher ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--text-primary)', display: 'inline-flex' }} aria-hidden="true"><SunIcon /></span>
      <select
        value={theme}
        onChange={event => setTheme(event.target.value as ThemeId)}
        aria-label="Choose theme"
        title={current?.label ?? 'Choose theme'}
        style={{
          height: 38,
          maxWidth: compact ? 132 : 190,
          padding: '0 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-2)',
          background: 'var(--surface)',
          color: 'var(--text-primary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <optgroup label="Light themes">
          {THEMES.filter(t => t.mode === 'light').map(t => (
            <option key={t.id} value={t.id}>● {t.label}</option>
          ))}
        </optgroup>
        <optgroup label="Dark themes">
          {THEMES.filter(t => t.mode === 'dark').map(t => (
            <option key={t.id} value={t.id}>● {t.label}</option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
