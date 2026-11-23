import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Droplets,
  PackageCheck,
  PackageOpen,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Truck,
  WashingMachine,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { useReducedMotion } from '../../feature-pack/hooks'
import type {
  LinenCustody,
  LinenTransition,
  LinenTransitionGroup,
} from '../../../types/linen'

const EASE = [0.16, 1, 0.3, 1] as const

/** One icon per real server action. Anything new falls back to the scan glyph,
 *  so the picker never breaks when the linen service adds an action. */
const ACTION_ICONS: Record<string, LucideIcon> = {
  collect: PackageOpen,
  receive: PackageCheck,
  start_wash: WashingMachine,
  complete_wash: Droplets,
  press: Wind,
  ready: BadgeCheck,
  deliver: Truck,
  retire: Archive,
  mark_missing: ShieldAlert,
  mark_damaged: TriangleAlert,
}

const GROUP_ICONS: Record<LinenCustody, LucideIcon> = {
  hotel: Building2,
  laundry: WashingMachine,
  exception: ShieldAlert,
}

/** The two custody labels come from the server catalogue; the copy here only
 *  describes the handoff between them, it does not invent a linen state. */
export function ScanSelectHero({
  title,
  description,
  note,
  groups = [],
}: {
  title: string
  description: string
  note: string
  groups?: LinenTransitionGroup[]
}) {
  const reduceMotion = useReducedMotion()
  const hotel = groups.find(group => group.custody === 'hotel')?.label ?? 'Hotel Hands'
  const laundry = groups.find(group => group.custody === 'laundry')?.label ?? 'Laundry Hands'

  return (
    <motion.section
      data-scan-hero
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE }}
      className="scan-hero relative isolate overflow-hidden rounded-2xl px-5 py-7 text-center sm:px-8 sm:py-9"
    >
      <span className="scan-hero-grid" aria-hidden="true" />
      <span className="scan-hero-orb scan-hero-orb--one" aria-hidden="true" />
      <span className="scan-hero-orb scan-hero-orb--two" aria-hidden="true" />
      <span className="scan-hero-orb scan-hero-orb--three" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-3">
        <span className="scan-eyebrow">
          <Sparkles size={12} /> Linen handoff
        </span>
        <h1
          className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl"
          style={{ fontFamily: '"Spectral", Georgia, serif' }}
        >
          {title}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>

        <div className="scan-hero-flow mt-1" aria-label={`${hotel} to ${laundry} and back to the hotel`}>
          <span className="scan-flow-chip" data-flow="hotel">
            <Building2 size={13} /> {hotel}
          </span>
          <motion.span
            aria-hidden="true"
            className="text-[var(--text-tertiary)]"
            animate={reduceMotion ? undefined : { x: [0, 4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowRight size={14} />
          </motion.span>
          <span className="scan-flow-chip" data-flow="laundry">
            <WashingMachine size={13} /> {laundry}
          </span>
          <span className="scan-flow-chip" data-flow="return" title="Back to the hotel">
            <RotateCcw size={13} /> <span className="hidden sm:inline">Return</span>
          </span>
        </div>

        <p className="scan-hero-note">
          <span className="scan-note-dot" aria-hidden="true" /> {note}
        </p>
      </div>
    </motion.section>
  )
}

export function CustodyGroupPanel({
  group,
  index,
  onSelect,
}: {
  group: LinenTransitionGroup
  index: number
  onSelect: (transition: LinenTransition) => void
}) {
  const reduceMotion = useReducedMotion()
  const Icon = GROUP_ICONS[group.custody] ?? ScanLine
  const count = group.transitions.length

  return (
    <motion.section
      data-custody={group.custody}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, delay: reduceMotion ? 0 : 0.08 + index * 0.09, ease: EASE }}
      className="scan-group relative overflow-hidden rounded-2xl border border-[var(--border)] p-4 shadow-[var(--shadow-sm)] sm:p-5"
    >
      <span className="scan-group-orb" aria-hidden="true" />
      <div className="relative z-10 mb-4 flex flex-wrap items-center gap-3">
        <span className="scan-group-icon" aria-hidden="true">
          <Icon size={19} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold tracking-wide text-[var(--text-primary)] sm:text-base">
              {group.label}
            </h2>
            <span className="scan-group-count">{count} {count === 1 ? 'action' : 'actions'}</span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{group.description}</p>
        </div>
        <span className="scan-group-arrow" aria-hidden="true">
          {group.custody === 'hotel' ? <ArrowUpRight size={16} /> : <ArrowRight size={16} />}
        </span>
      </div>

      <div className="scan-card-grid no-stack relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {group.transitions.map((transition, cardIndex) => (
          <ScanActionCard
            key={transition.action}
            transition={transition}
            index={cardIndex}
            onSelect={onSelect}
          />
        ))}
      </div>
    </motion.section>
  )
}

function ScanActionCard({
  transition,
  index,
  onSelect,
}: {
  transition: LinenTransition
  index: number
  onSelect: (transition: LinenTransition) => void
}) {
  const reduceMotion = useReducedMotion()
  const Icon = ACTION_ICONS[transition.action] ?? ScanLine

  return (
    <motion.button
      type="button"
      data-custody={transition.custody}
      onClick={() => onSelect(transition)}
      initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.34,
        delay: reduceMotion ? 0 : 0.05 + index * 0.05,
        ease: EASE,
      }}
      whileHover={reduceMotion ? undefined : { y: -5, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      className="scan-card group relative flex min-h-[172px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border px-3 py-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      aria-label={`${transition.label} — ${transition.to_status_label}`}
    >
      <span className="scan-card-orb" aria-hidden="true" />
      <span className="scan-card-sheen" aria-hidden="true" />

      <span className="relative z-10 flex w-full flex-col items-center gap-2">
        <span className="scan-card-icon" aria-hidden="true">
          <Icon size={21} strokeWidth={2} />
        </span>
        <span className="scan-card-status">{transition.to_status_label}</span>
        <span className="text-[15px] font-bold leading-tight text-[var(--text-primary)]">
          {transition.label}
        </span>
        <span className="scan-card-meta">
          <span className="font-[family-name:var(--font-mono)] text-[10px]">{transition.to_status}</span>
          {transition.terminal && <span className="scan-terminal">Final</span>}
          <ArrowRight size={12} className="scan-card-arrow" aria-hidden="true" />
        </span>
      </span>
    </motion.button>
  )
}

export type ScanStatTone = 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'brand'

/** One animated, colour-coded tile reused by both the live scan tab and the
 *  final summary so the two screens read as the same product. */
export function ScanStatCard({
  label,
  value,
  icon,
  tone = 'brand',
  index = 0,
  compact,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: ScanStatTone
  index?: number
  compact?: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      data-tone={tone}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: reduceMotion ? 0 : index * 0.04, ease: EASE }}
      className={`scan-stat relative overflow-hidden rounded-xl border border-[var(--border)] text-center ${compact ? 'px-2 py-2' : 'px-3 py-3'}`}
    >
      <span className="scan-stat-glow" aria-hidden="true" />
      <p className="relative z-10 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[var(--text-muted)]">
        <span className="scan-stat-icon" aria-hidden="true">{icon}</span>
        <span className="break-words">{label}</span>
      </p>
      <p className="relative z-10 mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
    </motion.div>
  )
}
