import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Button — the only button in the system.
 *
 * Hierarchy is carried by fill, not by decoration:
 *   primary    one per view; flat brand fill, no gradient, no glow
 *   secondary  the workhorse: bordered, neutral
 *   ghost      tertiary, no chrome until hovered
 *   outline    brand-coloured, for brand-adjacent secondary actions
 *   danger     destructive; `danger` = filled, `danger-ghost` = in-row delete
 *   link       text-only, for "read more" / inline navigation
 *
 * There is no scale, bounce or shadow on press: a business tool should feel
 * immediate, not animated.
 */
const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 select-none items-center justify-center gap-1.5',
    'whitespace-nowrap rounded-[6px] font-medium',
    'border transition-[background-color,border-color,color,box-shadow] duration-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ring-offset)]',
    'disabled:pointer-events-none disabled:opacity-45',
    "[&_svg]:shrink-0 [&_svg]:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary: [
          'border-[var(--brand)] bg-[var(--brand)] text-white',
          'hover:border-[var(--brand-hover)] hover:bg-[var(--brand-hover)]',
          'active:bg-[var(--brand-active)]',
          'shadow-[0_1px_2px_rgb(16_24_40/0.08)]',
        ].join(' '),
        secondary: [
          'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-secondary)]',
          'shadow-[0_1px_2px_rgb(16_24_40/0.04)]',
          'hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
        ].join(' '),
        ghost: [
          'border-transparent bg-transparent text-[var(--text-muted)]',
          'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
        ].join(' '),
        outline: [
          'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)]',
          'hover:border-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand-soft)_70%,var(--brand)_8%)]',
        ].join(' '),
        warning: [
          'border-[var(--warning-text)] bg-[var(--warning-text)] text-white',
          'hover:border-[color-mix(in_srgb,var(--warning-text)_85%,black)] hover:bg-[color-mix(in_srgb,var(--warning-text)_85%,black)]',
        ].join(' '),
        danger: [
          'border-[var(--danger-text)] bg-[var(--danger-text)] text-white',
          'hover:border-[color-mix(in_srgb,var(--danger-text)_85%,black)] hover:bg-[color-mix(in_srgb,var(--danger-text)_85%,black)]',
        ].join(' '),
        'danger-ghost': [
          'border-transparent bg-transparent text-[var(--danger-text)]',
          'hover:bg-[var(--danger-soft)]',
        ].join(' '),
        link: [
          'h-auto border-transparent bg-transparent p-0 text-[var(--brand-text)] underline-offset-4',
          'hover:text-[var(--brand-hover)] hover:underline',
        ].join(' '),
        // Legacy aliases kept so existing call sites keep their intent.
        default: '',
        destructive: '',
      },
      size: {
        xs: 'h-7 gap-1 px-2 text-[12px] [&_svg]:size-3.5',
        sm: 'h-8 gap-1.5 px-2.5 text-[12.5px] [&_svg]:size-4',
        default: 'h-9 gap-1.5 px-3.5 text-[13px] [&_svg]:size-4',
        lg: 'h-10 gap-2 px-4 text-[14px] [&_svg]:size-4',
        icon: 'h-8 w-8 p-0 [&_svg]:size-4',
        'icon-sm': 'h-7 w-7 p-0 [&_svg]:size-3.5',
        'icon-lg': 'h-10 w-10 p-0 [&_svg]:size-[18px]',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'secondary', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Puts the button in a pending state: disabled, `aria-busy`, and the label is
   * kept in place (not swapped for a bare spinner) so the button does not
   * change width mid-submit.
   */
  loading?: boolean
}

/** Pre-rename variant names mapped onto the current hierarchy. */
const VARIANT_ALIASES: Record<string, string> = {
  default: 'primary',
  destructive: 'danger',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block, asChild = false, loading, children, type, ...props },
    ref,
  ) => {
    const resolved = (variant && VARIANT_ALIASES[variant]) || variant
    const classes = cn(
      buttonVariants({ variant: resolved as any, size, block }),
      // The label stays visible while pending, so reserve the widest of the
      // two states and let the spinner occupy the leading slot.
      loading && 'cursor-progress',
      // With asChild the component is a Radix <Slot>, which requires EXACTLY
      // ONE child element and throws otherwise:
      //   "Slot failed to slot onto its children."
      // A sibling spinner breaks that — and so does a bare `{false}`, because
      // React.Children.count still tallies it, which is why the two branches
      // below are written out separately rather than sharing one element.
      // For asChild the spinner is painted as a ::before pseudo-element (see
      // .btn-pending in index.css) so no extra child is needed.
      loading && asChild && 'btn-pending',
      className,
    )

    if (asChild) {
      return (
        <Slot ref={ref} aria-busy={loading || undefined} className={classes} {...props}>
          {children}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        // A bare <button> inside a form defaults to submit; be explicit instead.
        type={type ?? 'button'}
        disabled={loading || props.disabled}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {loading && (
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-4 animate-spin"
            fill="none"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
            <path
              d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
