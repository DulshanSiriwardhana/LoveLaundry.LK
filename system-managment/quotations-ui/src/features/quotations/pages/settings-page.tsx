import {
  RiSettings3Line, RiTextSpacing, RiSunLine, RiContrastLine, RiMoonLine, RiCheckLine, RiPaletteLine,
  RiDropLine, RiLeafLine, RiArtboard2Line, RiCloudLine, RiEyeLine,
} from 'react-icons/ri'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { useTheme, type FontSize, type ThemePreset } from '../../../context/ThemeContext'

const FONT_OPTIONS: { value: FontSize; label: string; desc: string; px: string }[] = [
  { value: 'xs', label: 'Extra Small', desc: 'Maximum content density', px: '12px' },
  { value: 'sm', label: 'Small', desc: 'Compact, more content visible', px: '13px' },
  { value: 'md', label: 'Medium', desc: 'Default comfortable size', px: '14px' },
  { value: 'lg', label: 'Large', desc: 'Easier on the eyes', px: '15px' },
  { value: 'xl', label: 'Extra Large', desc: 'Great for presentations', px: '17px' },
  { value: 'xxl', label: 'XXL', desc: 'Maximum readability', px: '19px' },
]

interface ThemePresetOption {
  value: ThemePreset
  label: string
  desc: string
  icon: React.ReactNode
  group: 'light' | 'dark'
  swatchBg: string
  swatchSurface: string
  swatchBorder: string
  swatchText: string
  swatchMuted: string
}

const THEME_OPTIONS: ThemePresetOption[] = [
  // Light themes
  {
    value: 'light', label: 'Light', desc: 'The classic clean look',
    icon: <RiSunLine className="h-4 w-4 text-[#F59E0B]" />,
    group: 'light',
    swatchBg: '#F9FAFB', swatchSurface: '#FFFFFF', swatchBorder: '#E5E7EB', swatchText: '#101828', swatchMuted: '#6B7280',
  },
  {
    value: 'contrast', label: 'High Contrast', desc: 'Stronger borders, darker text',
    icon: <RiContrastLine className="h-4 w-4 text-[#2563EB]" />,
    group: 'light',
    swatchBg: '#F3F4F6', swatchSurface: '#FFFFFF', swatchBorder: '#94A3B8', swatchText: '#0B1220', swatchMuted: '#334155',
  },
  {
    value: 'ocean', label: 'Ocean Blue', desc: 'Cool blue-tinted professional',
    icon: <RiDropLine className="h-4 w-4 text-[#2563EB]" />,
    group: 'light',
    swatchBg: '#F0F5FF', swatchSurface: '#FFFFFF', swatchBorder: '#C7D7F0', swatchText: '#0C1929', swatchMuted: '#4A6485',
  },
  {
    value: 'forest', label: 'Forest Green', desc: 'Natural green-tinted warmth',
    icon: <RiLeafLine className="h-4 w-4 text-[#16A34A]" />,
    group: 'light',
    swatchBg: '#F0FAF4', swatchSurface: '#FFFFFF', swatchBorder: '#C5E0CC', swatchText: '#0A1F12', swatchMuted: '#376B44',
  },
  {
    value: 'sepia', label: 'Warm Sepia', desc: 'Cream newspaper tone',
    icon: <RiArtboard2Line className="h-4 w-4 text-[#D9520A]" />,
    group: 'light',
    swatchBg: '#FAF6F0', swatchSurface: '#FFFDF9', swatchBorder: '#DDD5C7', swatchText: '#2C2416', swatchMuted: '#6E6047',
  },
  {
    value: 'slate', label: 'Slate', desc: 'Balanced medium-grey professional',
    icon: <RiCloudLine className="h-4 w-4 text-[#475569]" />,
    group: 'light',
    swatchBg: '#E8ECF1', swatchSurface: '#FFFFFF', swatchBorder: '#B8C0CC', swatchText: '#0F172A', swatchMuted: '#475569',
  },
  // Dark themes
  {
    value: 'dark', label: 'Midnight', desc: 'Professional dark mode',
    icon: <RiMoonLine className="h-4 w-4 text-[#7C8A99]" />,
    group: 'dark',
    swatchBg: '#0F141B', swatchSurface: '#171E27', swatchBorder: '#2A3543', swatchText: '#F4F7FB', swatchMuted: '#93A0AE',
  },
  {
    value: 'nightblue', label: 'Night Blue', desc: 'Deep blue-tinted dark',
    icon: <RiMoonLine className="h-4 w-4 text-[#818CF8]" />,
    group: 'dark',
    swatchBg: '#0D0F1A', swatchSurface: '#141728', swatchBorder: '#252A42', swatchText: '#E8EAFF', swatchMuted: '#8890C0',
  },
  {
    value: 'contrast-dark', label: 'Contrast Dark', desc: 'Maximum contrast dark mode',
    icon: <RiEyeLine className="h-4 w-4 text-[#FF4444]" />,
    group: 'dark',
    swatchBg: '#000000', swatchSurface: '#0D0D0D', swatchBorder: '#3A3A3A', swatchText: '#FFFFFF', swatchMuted: '#AAAAAA',
  },
]

function OptionButton({ active, onClick, children, className = '' }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all cursor-pointer',
        active
          ? 'border-[var(--red-600)] bg-[color-mix(in_srgb,var(--red-600)_8%,var(--surface))]'
          : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--red-500)] hover:bg-[var(--surface-hover)]',
        className,
      ].join(' ')}
    >
      {active && (
        <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--red-600)]">
          <RiCheckLine className="h-2.5 w-2.5 text-white" />
        </span>
      )}
      {children}
    </button>
  )
}

export default function SettingsPage() {
  const { fontSize, theme, setFontSize, setTheme } = useTheme()
  const lightThemes = THEME_OPTIONS.filter(t => t.group === 'light')
  const darkThemes = THEME_OPTIONS.filter(t => t.group === 'dark')

  return (
    <div className="space-y-6 pb-10 select-none">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]} />
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
            <RiSettings3Line className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <h1 className="text-dashboard-title">Settings</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Customize display, fonts and accessibility
            </p>
          </div>
        </div>
      </div>

      {/* Theme Preset — Light Themes */}
      <Card>
        <CardHeader className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
              <RiPaletteLine className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <CardTitle>Light Themes</CardTitle>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Clean, bright themes for daytime use
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lightThemes.map(opt => (
              <OptionButton key={opt.value} active={theme === opt.value} onClick={() => setTheme(opt.value)}>
                <div className="flex items-center gap-2">
                  {opt.icon}
                  <span className="font-semibold text-[13px]">{opt.label}</span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{opt.desc}</span>
                <div className="mt-2 flex gap-1.5">
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchBg, borderColor: opt.swatchBorder }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchSurface, borderColor: opt.swatchBorder }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchBorder }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchText }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchMuted }} />
                </div>
              </OptionButton>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Theme Preset — Dark Themes */}
      <Card>
        <CardHeader className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E1B4B] border border-[#4338CA]">
              <RiMoonLine className="h-4 w-4 text-[#A5B4FC]" />
            </div>
            <div>
              <CardTitle>Dark Themes</CardTitle>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Easy on the eyes for nighttime and low-light use
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {darkThemes.map(opt => (
              <OptionButton key={opt.value} active={theme === opt.value} onClick={() => setTheme(opt.value)}>
                <div className="flex items-center gap-2">
                  {opt.icon}
                  <span className="font-semibold text-[13px]">{opt.label}</span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{opt.desc}</span>
                <div className="mt-2 flex gap-1.5">
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchBg, borderColor: opt.swatchBorder }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchSurface, borderColor: opt.swatchBorder }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchBorder }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchText }} />
                  <div className="h-5 w-5 rounded-md border" style={{ background: opt.swatchMuted }} />
                </div>
              </OptionButton>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
              <RiTextSpacing className="h-4 w-4 text-[#16A34A]" />
            </div>
            <div>
              <CardTitle>Font Size</CardTitle>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Controls text size across the entire application
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {FONT_OPTIONS.map(opt => (
              <OptionButton key={opt.value} active={fontSize === opt.value} onClick={() => setFontSize(opt.value)}>
                <span className="font-semibold" style={{ fontSize: opt.px }}>{opt.label}</span>
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{opt.desc}</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-faint)' }}>{opt.px}</span>
              </OptionButton>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED] border border-[#FED7AA]">
              <RiPaletteLine className="h-4 w-4 text-[#EA580C]" />
            </div>
            <div>
              <CardTitle>Live Preview</CardTitle>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                How your text and colors look with current settings
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
            <h3 className="font-bold" style={{ fontSize: 'calc(var(--body-font-size) + 4px)', color: 'var(--text-primary)' }}>
              Invoice #INV-20260811-0001
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--body-font-size)' }}>
              This is secondary text — client details, dates, and descriptions appear in this color.
            </p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'calc(var(--body-font-size) - 1px)' }}>
              This is tertiary text — labels, captions, and metadata appear here.
            </p>
            <div className="flex gap-3 pt-1 flex-wrap">
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Client Name</p>
                <p className="font-semibold" style={{ fontSize: 'var(--body-font-size)', color: 'var(--text-primary)' }}>Hilton Colombo</p>
              </div>
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Amount</p>
                <p className="font-semibold" style={{ fontSize: 'var(--body-font-size)', color: 'var(--text-primary)' }}>LKR 84,500</p>
              </div>
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Status</p>
                <p className="font-semibold text-[#16A34A]" style={{ fontSize: 'var(--body-font-size)' }}>Paid</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Changes apply instantly and are saved automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
