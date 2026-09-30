import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SearchableOption {
  value: string
  label: string
  sub?: string
  hint?: string
}

export interface SearchableSelectProps {
  value: string
  onValueChange: (v: string) => void
  options: SearchableOption[]
  /** Fired when an option is chosen (mouse click or Enter/Arrow+Enter). */
  onSelect?: (opt: SearchableOption) => void
  /** Fired when Enter is pressed with no matching option (free text entry). */
  onCreate?: (text: string) => void
  /** Called after a selection commits so the form grid can advance focus. */
  onAdvance?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  autoFocus?: boolean
  /** Max dropdown rows. */
  maxOptions?: number
  closeOnSelect?: boolean
  /** React 19 ref — forwarded to the internal input so grids can register it. */
  ref?: Ref<HTMLInputElement>
}

/**
 * Keyboard-friendly searchable select / autocomplete.
 *
 * Keys:
 *  - ArrowDown/ArrowUp  → move the highlight (dropdown open)
 *  - Enter              → commit highlighted option (or first match), then
 *                          `onAdvance()` so the grid can move to the next cell
 *  - Enter (no match)   → `onCreate(text)` if provided, else bubbles so the
 *                          grid advances as free text
 *  - Escape             → close the dropdown
 *  - Tab                → commit highlighted option (if open) without advancing
 *
 * It never calls preventDefault/stopPropagation for Enter when the dropdown is
 * closed, allowing the surrounding useDataGrid handler to move focus to the
 * next field (Item → Enter → Quantity).
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  onSelect,
  onCreate,
  onAdvance,
  placeholder,
  className,
  disabled,
  required,
  autoFocus,
  maxOptions = 8,
  closeOnSelect = true,
  ref,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options.slice(0, maxOptions)
    return options.filter(o => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q)).slice(0, maxOptions)
  }, [value, options, maxOptions])

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset highlight when the filter changes / dropdown opens.
  useEffect(() => {
    setHighlight(filtered.length > 0 && open ? 0 : -1)
  }, [value, open, filtered.length])

  const commit = useCallback((opt: SearchableOption, advance = true) => {
    onValueChange(opt.label)
    onSelect?.(opt)
    if (closeOnSelect) setOpen(false)
    if (advance) onAdvance?.()
  }, [onValueChange, onSelect, onAdvance, closeOnSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Escape') {
      setOpen(false)
      e.stopPropagation()
      return
    }
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault()
      e.stopPropagation()
      setHighlight(h => (h < filtered.length - 1 ? h + 1 : h))
      return
    }
    if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      e.stopPropagation()
      setHighlight(h => (h > 0 ? h - 1 : h))
      return
    }
    if (e.key === 'Enter') {
      if (open && filtered.length > 0) {
        const opt = filtered[highlight >= 0 ? highlight : 0]
        if (opt) {
          e.preventDefault()
          e.stopPropagation()
          commit(opt, true)
          return
        }
      }
      if (open) {
        // No matches — treat as free text.
        setOpen(false)
        if (onCreate) {
          e.preventDefault()
          e.stopPropagation()
          onCreate(value)
          onAdvance?.()
        }
        // Without onCreate: close and let the grid advance (do not preventDefault).
        return
      }
      return // closed: let the grid advance
    }
    if (e.key === 'Tab' && open && filtered.length > 0) {
      const opt = filtered[highlight >= 0 ? highlight : 0]
      if (opt) commit(opt, false)
    }
  }, [disabled, open, filtered, highlight, value, onCreate, onAdvance, commit])

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => { onValueChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        className={className}
        role="combobox"
        aria-expanded={open}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setOpen(o => !o)}
        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--text-faint)] transition-colors hover:text-[var(--text-primary)]"
        aria-label="Toggle options"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-hidden overflow-y-auto rounded-[8px] border border-[var(--border-2)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]">
          {filtered.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); commit(opt, false) }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[13px] transition-colors duration-75 ${
                i === highlight ? 'bg-[var(--brand-soft)]' : 'hover:bg-[var(--surface-hover)]'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--text-primary)]">{opt.label}</span>
                {(opt.sub || opt.hint) && (
                  <span className="block truncate text-[11px] text-[var(--text-faint)]">{opt.sub ?? opt.hint}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}