'use client'

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { Eyebrow } from './text'

/**
 * The labelled control every drawer form is built from: the eyebrow, one
 * input, and under it either a hint or the field's error. An error puts a red
 * border on the control and names it to assistive tech through aria-invalid
 * and aria-describedby, so the message is read where the mistake is.
 */
export function Field({
  label,
  error,
  required,
  hint,
  className,
  children,
}: {
  label: ReactNode
  /** The message under the field, in the bad colour. Absent, the hint shows. */
  error?: string
  required?: boolean
  hint?: ReactNode
  className?: string
  /** One input, select or textarea; anything else is rendered as given. */
  children: ReactNode
}) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  const control = isValidElement<{ className?: string }>(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': note ? noteId : undefined,
        'aria-required': required || undefined,
        className: cn(
          children.props.className,
          error &&
            'border-bad focus-visible:border-bad focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--risk)_28%,transparent)]',
        ),
      })
    : children

  // The label names the control through htmlFor rather than by wrapping it,
  // so the message and hint stay out of the control's accessible name and
  // reach it through aria-describedby alone.
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id}>
        <Eyebrow>{label}</Eyebrow>
      </label>
      {control}
      {error ? (
        <span id={noteId} role="alert" className="text-[12px] leading-[1.4] text-bad">
          {error}
        </span>
      ) : (
        hint && (
          <span id={noteId} className="t-caption text-ink-3">
            {hint}
          </span>
        )
      )}
    </div>
  )
}

/**
 * The client-side check a form runs before it sends. `check` returns one
 * message per invalid field from the current draft; nothing shows until the
 * first submit, and from then on the messages follow the draft as it is
 * fixed. `submit()` says whether the draft passed, and each failed attempt
 * scrolls the first invalid control into view and focuses it. The server's
 * own validation stays the truth; this only saves the round trip.
 */
export function useFormErrors<K extends string>(check: () => Partial<Record<K, string>>) {
  const [tried, setTried] = useState(0)
  const ref = useRef<HTMLFormElement>(null)
  const errors: Partial<Record<K, string>> = tried ? check() : {}

  useEffect(() => {
    if (!tried) return
    const first = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    first?.focus({ preventScroll: true })
  }, [tried])

  const submit = (): boolean => {
    setTried((n) => n + 1)
    return Object.values(check()).every((m) => !m)
  }

  return { errors, ref, submit }
}

/** On a textarea, Cmd or Ctrl Enter submits the form the way Enter does in a single-line field. */
export function submitOnModEnter(e: KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    e.currentTarget.form?.requestSubmit()
  }
}
