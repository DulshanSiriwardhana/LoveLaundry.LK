import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Dialog — one overlay, one set of sizes.
 *
 * Sizes are semantic (`sm` confirm, `md` form, `lg` record, `xl` document), so
 * two dialogs doing the same job are the same size everywhere in the app.
 *
 * Mobile behaviour is intentional rather than inherited: below `sm` a dialog
 * becomes a bottom-anchored sheet that is always fully scrollable and keeps its
 * footer in reach, instead of a centred box that clips its own content.
 */
const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const SIZES = {
  sm: 'sm:max-w-[400px]',
  md: 'sm:max-w-[560px]',
  lg: 'sm:max-w-[760px]',
  xl: 'sm:max-w-[1024px]',
} as const

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'overlay-root overlay-backdrop fixed inset-0 z-50',
      'data-[state=open]:animate-[fade-in_120ms_ease-out] data-[state=closed]:animate-[fade-in_120ms_ease-out_reverse]',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: keyof typeof SIZES
  /** Hides the built-in close button when the dialog supplies its own. */
  hideClose?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, id, size = 'md', hideClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      id={id}
      className={cn(
        // Mobile: bottom sheet. Desktop: centred dialog.
        'fixed z-50 flex flex-col bg-[var(--surface)] shadow-[var(--shadow-pop)]',
        'inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[12px] border-t border-[var(--border)]',
        'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[calc(100dvh-48px)] sm:w-[calc(100vw-48px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[10px] sm:border',
        'outline-none',
        'data-[state=open]:animate-[slide-up_160ms_cubic-bezier(0.16,1,0.3,1)]',
        'data-[state=closed]:animate-[fade-in_100ms_ease-out_reverse]',
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className={cn(
            'absolute top-2.5 right-2.5 z-10 flex size-7 items-center justify-center rounded-[6px]',
            'text-[var(--text-faint)] transition-colors duration-100',
            'hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          )}
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

/** Title band. Left-aligned on every size — centred titles waste a line. */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 pr-12 sm:px-5',
      className,
    )}
    {...props}
  />
)

/** Scrollable middle. The only region that grows. */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5', className)}
    {...props}
  />
)

/** Pinned action row. Order is cancel-then-confirm on desktop, reversed on
    mobile so the primary action lands under the thumb. */
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 sm:flex-row sm:justify-end sm:px-5',
      className,
    )}
    {...props}
  />
)

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-0.5 text-[12.5px] leading-[1.5] text-[var(--text-muted)]', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogBody, DialogFooter, DialogTitle, DialogDescription, DialogClose,
}
