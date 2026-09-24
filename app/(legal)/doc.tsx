import type { ReactNode } from 'react'
import { LEGAL } from '@/core/legal'

// The type for the three legal documents: one heading scale, one body size,
// and lists that read as lists. Plain on purpose; these are read, not scanned.
// 15px in a 640px column keeps a line near 75 characters.

/** Body copy: links look like links, lists like lists. Shared by the lede and every section. */
const PROSE =
  'space-y-3 text-[15px] leading-[1.6] text-ink-2 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5'

export function LegalDoc({ title, lede, children }: { title: string; lede: ReactNode; children: ReactNode }) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="t-headline text-ink">{title}</h1>
        <p className="t-caption text-ink-3">Effective {LEGAL.effective}</p>
        <div className={PROSE}>{lede}</div>
      </header>
      {children}
    </article>
  )
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="space-y-3 scroll-mt-6">
      <h2 id={`${id}-h`} className="t-title text-ink">
        {title}
      </h2>
      <div className={PROSE}>
        {children}
      </div>
    </section>
  )
}

export function Contact() {
  return (
    <p>
      {LEGAL.operator}, {LEGAL.address}. Email{' '}
      <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
    </p>
  )
}
