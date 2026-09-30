import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Form control contract — one height, one border, one focus treatment, one
 * disabled treatment. Every text input in the application is built from this.
 *
 * Height is `h-9` (36px) which keeps dense data-entry grids dense; the coarse-
 * pointer media query in index.css raises interactive controls to 40px on
 * touch devices and bumps the font to 16px so iOS does not zoom on focus.
 */
export const controlBase =
  'w-full rounded-[6px] border border-[var(--border-2)] bg-[var(--surface)] text-[13px] text-[var(--text-primary)] ' +
  'placeholder:text-[var(--text-placeholder)] ' +
  'transition-[border-color,box-shadow] duration-100 ' +
  'hover:border-[var(--border-strong)] ' +
  'focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand)_24%,transparent)] focus:ring-offset-0 ' +
  'disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-placeholder)] ' +
  'aria-[invalid=true]:border-[var(--danger-text)] aria-[invalid=true]:ring-[color-mix(in_srgb,var(--danger-text)_20%,transparent)]'

export const controlHeight = 'h-9'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders the invalid state. Pair with a `Field` error message. */
  invalid?: boolean
  /** Adds horizontal room for a leading icon. */
  hasPrefix?: boolean
  /** Adds horizontal room for a trailing adornment (suffix, clear button). */
  hasSuffix?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', invalid, hasPrefix, hasSuffix, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        controlBase,
        controlHeight,
        'px-3',
        hasPrefix && 'pl-9',
        hasSuffix && 'pr-9',
        type === 'number' && 'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, 'resize-y px-3 py-2 leading-[1.55]', className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          controlBase,
          controlHeight,
          'appearance-none py-0 pr-8 pl-3',
          '[&>option]:bg-[var(--surface)] [&>option]:text-[var(--text-primary)]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 8 4 4 4-4" />
      </svg>
    </div>
  ),
)
Select.displayName = 'Select'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  /** Hides the label visually while keeping it as the accessible name. */
  hideLabel?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, hideLabel, ...props }, ref) => (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-[13px] text-[var(--text-secondary)]', className)}>
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'size-4 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-[var(--border-2)] bg-[var(--surface)]',
          'transition-[background-color,border-color] duration-100',
          'checked:border-[var(--brand)] checked:bg-[var(--brand)]',
          'indeterminate:border-[var(--brand)] indeterminate:bg-[var(--brand)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1',
          "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3.5 8.5 3 3 6-6'/%3E%3C/svg%3E\")] checked:bg-center checked:bg-no-repeat",
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      />
      {label && <span className={cn(hideLabel && 'sr-only')}>{label}</span>}
    </label>
  ),
)
Checkbox.displayName = 'Checkbox'

export { Input, Textarea, Select, Checkbox }
