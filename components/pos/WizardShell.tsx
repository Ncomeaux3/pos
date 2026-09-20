'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ActionButton, type ActionButtonVariant } from './Button'
import { HolonLockup } from './Logo'
import { Eyebrow } from './text'

export type WizardStep = { key: string; name: string; hint?: string }

/**
 * Onboarding and the Weekly Review are the same six step shell: a clickable
 * step rail with a progress bar, a kicker over a big question over a helper
 * line, and a Back / Skip / primary footer whose label changes on the last
 * step. Built once here.
 */
export function WizardShell({
  steps,
  current,
  onStep,
  kicker,
  title,
  helper,
  children,
  onBack,
  onSkip,
  onNext,
  nextLabel = 'Continue',
  nextVariant = 'solid',
  backVariant = 'quiet',
  footnote,
  railTitle,
  railLede,
}: {
  steps: WizardStep[]
  current: string
  onStep: (key: string) => void
  kicker: ReactNode
  title: ReactNode
  helper?: ReactNode
  children: ReactNode
  onBack?: () => void
  onSkip?: () => void
  onNext: () => void
  nextLabel?: string
  /** Onboarding's artboard draws an accent primary and a bordered Back; the review's does not. */
  nextVariant?: ActionButtonVariant
  backVariant?: ActionButtonVariant
  footnote?: ReactNode
  railTitle: string
  railLede?: string
}) {
  const index = Math.max(0, steps.findIndex((s) => s.key === current))
  const pct = Math.round(((index + 1) / steps.length) * 100)

  return (
    <div className="flex min-h-dvh flex-col gap-8 p-7 lg:flex-row lg:gap-12">
      <aside className="w-full shrink-0 space-y-6 lg:w-[264px]">
        <HolonLockup size={26} />
        <div className="space-y-2">
          <h1 className="t-title text-ink">{railTitle}</h1>
          {railLede && <p className="t-caption text-ink-3">{railLede}</p>}
        </div>

        <div className="space-y-1">
          <div className="h-0.5 w-full bg-rule">
            <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between">
            <Eyebrow>{steps[index]?.name}</Eyebrow>
            <span className="num text-[11px] text-ink-3">{pct}%</span>
          </div>
        </div>

        <ol className="space-y-0.5">
          {steps.map((s, i) => {
            const done = i < index
            const on = s.key === current
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onStep(s.key)}
                  aria-current={on ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-baseline gap-3 border-l-2 py-2.5 pl-3 pr-2 text-left transition-colors duration-150',
                    on ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-bg-elev',
                  )}
                >
                  <span
                    className={cn(
                      'label w-4 shrink-0 text-[11px]',
                      done ? 'text-ok' : on ? 'text-ink' : 'text-ink-4',
                    )}
                  >
                    {done ? '✓' : String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-sm', on ? 'text-ink' : 'text-ink-2')}>{s.name}</span>
                    {s.hint && <span className="block text-[11px] text-ink-3">{s.hint}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="max-w-[64ch] space-y-3">
          <Eyebrow>{kicker}</Eyebrow>
          <h2 className="t-headline text-ink">
            {title}
          </h2>
          {helper && <p className="t-body text-ink-3">{helper}</p>}
        </div>

        <div className="mt-7 min-h-0 flex-1">{children}</div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
          <div className="flex items-center gap-2">
            {onBack && (
              <ActionButton variant={backVariant} onClick={onBack}>
                Back
              </ActionButton>
            )}
            {onSkip && (
              <ActionButton variant="quiet" onClick={onSkip}>
                Skip for now
              </ActionButton>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {footnote && <span className="text-[11px] text-ink-3">{footnote}</span>}
            <ActionButton variant={nextVariant} onClick={onNext} className="px-4">
              {nextLabel}
            </ActionButton>
          </div>
        </div>
      </main>
    </div>
  )
}
