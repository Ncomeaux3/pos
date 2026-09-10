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
 * width band, with the step named in the band and the progress as six dashes
 * at the foot of the column.
 *
 * Measured, not guessed:
 *   band     h96, padding 24px 28px 18px, 1px --rule underneath
 *   progress 2px full bleed under the band, --accent on --rule-2
 *   column   760px wide, centred in the space beside the sidebar
 *   kicker   11px, 0.16em, --accent (the one place the eyebrow is not grey)
 *   question 38px / 400 / -0.03em
 *   dashes   6 x 34x3, 6px apart, --accent for done, --rule-2 for the rest
 */
export function ReviewShell({
  steps,
  current,
  onStep,
  weekLabel,
  kicker,
  title,
  helper,
  children,
  onBack,
  onSkip,
  onNext,
  nextLabel = 'Continue',
  footnote,
  duration = 'Usually 8 minutes',
  themeToggle,
}: {
  steps: ReviewStep[]
  current: string
  onStep: (key: string) => void
  /** "1 - 7 Sep 2026". Sits beside the week number in the band. */
  weekLabel: string
  kicker: ReactNode
  title: ReactNode
  helper?: ReactNode
  children: ReactNode
  onBack?: () => void
  onSkip?: () => void
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
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-rule px-7 pb-[18px] pt-6">
        {/* The artboard names the week and the step, never the page. The page
            still needs a heading, so it has one and it is not drawn. */}
        <h1 className="sr-only">Weekly review</h1>
        <div className="min-w-0">
          <span className="eyebrow text-ink-3">
            <span className="status-dot" aria-hidden />
            Week {weekLabel}
          </span>
          {/* The step is named here rather than in a rail. */}
          <p className="mt-2.5 text-[15px] text-ink-2">
            {steps[index]?.name} / step {index + 1} of {steps.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
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

      <div className="px-7 py-7">
        <div className="mx-auto w-full max-w-[760px] space-y-6">
          <div className="space-y-3">
            <p className="label text-[11px] tracking-[0.16em] text-brand">{kicker}</p>
            <h2 className="text-[clamp(26px,3vw,38px)] font-normal leading-[1.1] tracking-[-0.03em] text-ink">
              {title}
            </h2>
            {helper && <p className="max-w-[70ch] text-[14px] leading-[1.55] text-ink-3">{helper}</p>}
          </div>

          {children}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
            {onBack && (
              <ActionButton variant="quiet" onClick={onBack}>
                Back
              </ActionButton>
            )}
            <ActionButton size="lg" variant="accent" onClick={onNext}>
              {nextLabel}
            </ActionButton>
            {onSkip && (
              <ActionButton variant="quiet" onClick={onSkip}>
                Skip for now
              </ActionButton>
            )}
            <span className="ml-auto text-[12px] text-ink-3">
              {footnote ?? 'Answers save as you go'}
            </span>
          </div>

          {/* Six dashes, not a percentage bar. Clickable, because the steps are
              and a reader who can see where they are should be able to go
              there. */}
          <nav aria-label="Review steps" className="flex gap-1.5 pt-1">
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
                  i <= index ? 'bg-brand' : 'bg-rule-2 hover:bg-ink-4',
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
 * The review's glance card: a quiet 11px label, a 26px/300 number, and a small
 * coloured line under it. Not MetricTile, which is a cell of a joined strip;
 * these are separate 183px cards with 10px between them.
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
    <div className="flex flex-col gap-1.5 border border-rule-2 bg-bg-elev p-4">
      <span className="text-[11px] leading-none text-ink-3">{label}</span>
      <span className="num text-[26px] font-light leading-none tracking-[-0.02em] text-ink">
        {value}
      </span>
      {delta && (
        <span
          className={cn(
            'text-[10px] leading-none',
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
    <p className="border-l-2 border-brand py-1 pl-4 text-[14px] leading-[1.55] text-ink">
      {children}
    </p>
  )
}
