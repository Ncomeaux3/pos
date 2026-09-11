'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ActionButton } from './Button'

export type ReviewStep = { key: string; name: string }

/**
 * The Weekly Review shell, measured off `POS Weekly Review.dc.html`.
 *
 * Not the WizardShell. Onboarding and this one are six step flows over one set
 * of answers, but their artboards are different shapes and only Onboarding has
 * the step rail: the review is a single 760px column centred under a full
 * width band, with the step named in the band, the progress drawn twice, and
 * no skip control.
 *
 * Measured, not guessed:
 *   band     padding 24px 28px 18px, 1px --rule underneath, gap 20px
 *   progress 2px full bleed, --accent on --rule-2, filled to the step
 *   column   760px wide, padding 40px 28px 44px
 *   kicker   11px, 0.16em, --accent (the one place the eyebrow is not grey)
 *   question 26 to 38px / 400 / -0.03em / 1.08, 16px under the kicker
 *   helper   14px --ink-3 / 1.6, 14px under the question, max 600px
 *   body     30px under the helper, nav 38px under the body, dashes 26px on
 *   dashes   6 x 34x3, 6px apart: --accent here, --ink-4 behind, --rule-2 ahead
 */
export function ReviewShell({
  steps,
  current,
  onStep,
  week,
  weekLabel,
  kicker,
  title,
  helper,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  footnote,
  duration = 'Usually 8 minutes',
  themeToggle,
}: {
  steps: ReviewStep[]
  current: string
  onStep: (key: string) => void
  /** The ISO week number, named in the band as the design has it. */
  week: number
  /** "1 - 7 Sep 2026". Sits beside the week number in the band. */
  weekLabel: string
  kicker: ReactNode
  title: ReactNode
  helper?: ReactNode
  children: ReactNode
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  footnote?: ReactNode
  duration?: ReactNode
  themeToggle?: ReactNode
}) {
  const index = Math.max(
    0,
    steps.findIndex((s) => s.key === current),
  )

  return (
    <div className="-m-7">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-rule px-7 pb-[18px] pt-6">
        {/* The artboard names the week and the step, never the page. The page
            still needs a heading, so it has one and it is not drawn. */}
        <h1 className="sr-only">Weekly review</h1>
        <div className="min-w-0">
          <span className="eyebrow text-ink-3">
            <span className="status-dot" aria-hidden />
            Week {week} · {weekLabel}
          </span>
          <p className="mt-2.5 text-[15px] text-ink-2">
            {steps[index]?.name} · step {index + 1} of {steps.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="label text-[10px] tracking-[0.12em] text-ink-3">{duration}</span>
          {themeToggle}
        </div>
      </header>

      {/* The band's own progress: 2px, full bleed, filled to the step you are
          on. The dashes at the foot of the column are the same progress made
          clickable; this is the part you see without looking for it. */}
      <div className="h-[2px] bg-rule-2" aria-hidden>
        <div
          className="h-full bg-brand transition-[width] duration-300"
          style={{ width: `${Math.round(((index + 1) / steps.length) * 100)}%` }}
        />
      </div>

      <div className="flex justify-center px-7 pb-11 pt-10">
        <div className="w-full max-w-[760px]">
          <p className="label text-[11px] tracking-[0.16em] text-brand">{kicker}</p>
          <h2 className="mt-4 text-pretty text-[clamp(26px,3vw,38px)] font-normal leading-[1.08] tracking-[-0.03em] text-ink">
            {title}
          </h2>
          {helper && (
            <p className="mt-3.5 max-w-[600px] text-pretty text-[14px] leading-[1.6] text-ink-3">
              {helper}
            </p>
          )}

          <div className="mt-[30px]">{children}</div>

          <div className="mt-[38px] flex flex-wrap items-center gap-3">
            {onBack && (
              <ActionButton size="lg" variant="outline" onClick={onBack}>
                Back
              </ActionButton>
            )}
            <ActionButton size="lg" variant="accent" onClick={onNext}>
              {nextLabel}
            </ActionButton>
            {/* No skip: the artboard has none. What it has instead is a line
                saying you can move on and come back, which Continue already
                does. */}
            <span className="ml-auto text-[12px] text-ink-3">
              {footnote ?? 'Answers save as you go'}
            </span>
          </div>

          {/* Six dashes, not a percentage bar. Clickable, because the steps are
              and a reader who can see where they are should be able to go
              there. */}
          <nav aria-label="Review steps" className="mt-[26px] flex flex-wrap gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onStep(s.key)}
                aria-current={s.key === current ? 'step' : undefined}
                // Numbered, so "Close" the step and "Close the week" the
                // button are distinguishable to anyone driving by name.
                aria-label={`${String(i + 1).padStart(2, '0')} ${s.name}`}
                className={cn(
                  'h-[3px] w-[34px] transition-colors duration-150',
                  i === index ? 'bg-brand' : i < index ? 'bg-ink-4' : 'bg-rule-2 hover:bg-ink-4',
                )}
              />
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

/**
 * The review's text field: 44px, 1px rule-2, no fill.
 *
 * Not `fieldClass`, which sits on the deep ground and is 35px: the review's
 * artboard puts its inputs on the page itself at the height of the primary
 * button beside them.
 */
export const reviewField =
  'h-11 min-w-0 border border-rule-2 bg-transparent px-[13px] text-[14px] text-ink ' +
  'outline-none placeholder:text-ink-4 focus-visible:border-brand'

/**
 * The review's glance card: a quiet 11px label, a 26px/300 number, and a small
 * coloured line under it. Not MetricTile, which is a cell of a joined strip;
 * these are separate 170px cards with 10px between them.
 */
export function GlanceCard({
  label,
  value,
  delta,
  tone = 'brand',
}: {
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  tone?: 'brand' | 'warn' | 'bad' | 'quiet'
}) {
  return (
    <div className="border border-rule-2 bg-bg-elev p-4">
      <span className="block text-[11px] leading-none text-ink-3">{label}</span>
      <span className="num mt-[9px] block text-[26px] font-light leading-none tracking-[-0.02em] text-ink">
        {value}
      </span>
      {delta && (
        <span
          className={cn(
            'mt-1.5 block text-[10px] leading-none',
            tone === 'warn'
              ? 'text-warn'
              : tone === 'bad'
                ? 'text-bad'
                : tone === 'quiet'
                  ? 'text-ink-3'
                  : 'text-brand',
          )}
        >
          {delta}
        </span>
      )}
    </div>
  )
}

/** The pull quote under the glance: 2px accent rule on the left, 14px ink. */
export function ReviewNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 max-w-[620px] border-l-2 border-brand py-1 pl-4 text-[14px] leading-[1.6] text-ink">
      {children}
    </p>
  )
}

/**
 * A row you tick: the wins list and the backlog picker are the same object with
 * a different mark on the left. 15px title, 11px meta, and selected is a 1px
 * accent border with the soft fill.
 */
export function ReviewRow({
  mark,
  title,
  meta,
  right,
  selected,
  onClick,
  label,
}: {
  mark: ReactNode
  title: ReactNode
  meta?: ReactNode
  right?: ReactNode
  selected?: boolean
  onClick: () => void
  /** Screen reader name, since the row is a control rather than a list item. */
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-3.5 gap-y-3 border px-4 py-[15px] text-left',
        'transition-colors duration-150 active:scale-[.985]',
        selected ? 'border-brand bg-brand-soft' : 'border-rule-2 bg-bg-elev hover:border-ink-4',
      )}
    >
      {mark}
      <span className="min-w-0 flex-[1_1_200px]">
        <span className="block text-[15px] text-ink">{title}</span>
        {meta && (
          <span className="mt-1 block text-[11px] uppercase tracking-[0.06em] text-ink-3">{meta}</span>
        )}
      </span>
      {right}
    </button>
  )
}
