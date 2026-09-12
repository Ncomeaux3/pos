'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ActionButton } from './Button'
import { fieldClass } from './field'

/**
 * Click the value, it becomes an input. Enter saves, Escape cancels and keeps
 * what was there. Used for the Review after-value, dashboard proposals and the
 * Settings skill rename.
 */
export function InlineEdit({
  value,
  onSave,
  label,
  multiline,
  className,
}: {
  value: string
  onSave: (next: string) => void
  label: string
  multiline?: boolean
  className?: string
}) {
  // The draft only exists while editing, and is seeded on the way in, so there
  // is no state to keep in sync with the prop and no effect to do it.
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null

  function commit() {
    if (draft !== null && draft !== value) onSave(draft)
    setDraft(null)
  }

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        onClick={() => setDraft(value)}
        className={cn(
          'w-full rounded-md border border-transparent px-2.5 py-2 text-left text-sm text-ink',
          'transition-colors duration-150 hover:border-rule',
          className,
        )}
      >
        {value || <span className="text-ink-4">Empty</span>}
      </button>
    )
  }

  const shared = {
    autoFocus: true,
    'aria-label': label,
    value: draft,
    onBlur: commit,
    className: cn(fieldClass, className),
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setDraft(null)
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      commit()
    }
  }

  return multiline ? (
    <textarea
      {...shared}
      rows={3}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
    />
  ) : (
    <input {...shared} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
  )
}

/**
 * Press once to arm, again within three seconds to do it. Stands in for the
 * confirmation modal the design does not have.
 */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  submit,
  className,
}: {
  children: React.ReactNode
  confirmLabel: string
  onConfirm?: () => void
  /**
   * Submits the surrounding form on the second press. The armed button carries
   * type="submit" so the form's own action runs, which keeps this usable with a
   * server action and no client handler.
   */
  submit?: boolean
  className?: string
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <ActionButton
      type={armed && submit ? 'submit' : 'button'}
      variant={armed ? 'danger' : 'outline'}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm?.()
        } else {
          setArmed(true)
        }
      }}
      className={className}
    >
      {armed ? confirmLabel : children}
    </ActionButton>
  )
}

/**
 * Masked until asked. The value is only ever passed in after a server side
 * reveal action; list payloads carry the mask, never the secret.
 */
export function SecretField({
  masked,
  reveal,
  label,
  className,
}: {
  masked: string
  /** Fetches the plaintext. Called once, on the first reveal. */
  reveal: () => Promise<string>
  label: string
  className?: string
}) {
  const [shown, setShown] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <code className="code min-w-0 flex-1 truncate rounded-md border border-rule-2 bg-bg-deep px-2.5 py-2 text-xs text-ink">
        {shown ?? masked}
      </code>
      <ActionButton
        disabled={busy}
        onClick={async () => {
          if (shown) return setShown(null)
          setBusy(true)
          try {
            setShown(await reveal())
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Revealing' : shown ? 'Hide' : 'Reveal'}
      </ActionButton>
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** A command you are meant to paste somewhere else. */
export function CopyBlock({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <div className={cn('flex items-start gap-2 rounded-md border border-rule-2 bg-bg-deep p-3', className)}>
      <code className="code min-w-0 flex-1 break-all text-xs leading-relaxed text-ink-2">{value}</code>
      <ActionButton
        variant={copied ? 'brand' : 'outline'}
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => setCopied(true))
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </ActionButton>
    </div>
  )
}
