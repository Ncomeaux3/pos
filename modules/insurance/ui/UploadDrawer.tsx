'use client'

import { useRef, useState, useTransition } from 'react'
import { ActionButton, Eyebrow, Overlay } from '@/components/pos'
import { cn } from '@/lib/utils'
import { LOW_CONFIDENCE, type DraftField } from '../draft'
import { createFromDraft, discardDraft, draftPolicy } from './actions'

/**
 * Drop a declarations page, confirm what was read off it, create the policy.
 *
 * Three states, as the artboard draws them: the drop zone, a running card
 * while the model reads the page, and the review grid. The draft lives here
 * and not in the URL because it only exists after a model call.
 */
export function UploadDrawer({
  open,
  onClose,
  toast,
}: {
  open: boolean
  onClose: () => void
  toast: (message: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [, start] = useTransition()
  const [working, setWorking] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [draft, setDraft] = useState<{
    fields: DraftField[]
    filePath: string
    fileName: string
  } | null>(null)

  const send = (file: File) => {
    setWorking(`${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`)
    start(async () => {
      const form = new FormData()
      form.set('file', file)
      const result = await draftPolicy(form)
      setWorking(null)
      if (!result.ok) toast(result.error)
      else setDraft({ fields: result.fields, filePath: result.filePath, fileName: result.fileName })
    })
  }

  const close = () => {
    if (draft) discardDraft(draft.filePath)
    setDraft(null)
    onClose()
  }

  const footerLine = draft
    ? 'Edit anything that looks off, then create.'
    : working
      ? 'Working…'
      : 'Declarations pages work best.'

  return (
    <Overlay
      open={open}
      onClose={close}
      eyebrow="Insurance / Upload PDF"
      footer={
        <>
          <span className="text-[11px] text-ink-3">{footerLine}</span>
          {draft && (
            <ActionButton
              variant="solid"
              size="xl"
              onClick={() => {
                const fields = Object.fromEntries(draft.fields.map((f) => [f.key, f.value]))
                start(async () => {
                  const result = await createFromDraft({
                    fields,
                    filePath: draft.filePath,
                    fileName: draft.fileName,
                    pages: 0,
                  })
                  if (!result.ok) toast(result.error)
                  else {
                    toast('Policy created, with the PDF attached to it.')
                    setDraft(null)
                    onClose()
                  }
                })
              }}
            >
              Create policy <span aria-hidden="true">&rarr;</span>
            </ActionButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-[18px]">
        {!draft && !working && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') input.current?.click()
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const file = e.dataTransfer.files?.[0]
              if (!file) return
              if (file.type !== 'application/pdf') toast('That is not a PDF')
              else send(file)
            }}
            className={cn(
              'cursor-pointer rounded-xl border border-dashed px-6 py-10 text-center transition-colors duration-150 hover:border-brand',
              over ? 'border-brand' : 'border-rule-2',
            )}
          >
            <div className="text-[14px]">Drop a policy PDF</div>
            <div className="mt-1.5 text-[12px] leading-[1.5] text-ink-3">
              Declarations page works best. The PDF goes to Anthropic with your own key and the
              fields are drafted for you to confirm. Nothing is saved until you do.
            </div>
            <input
              ref={input}
              type="file"
              accept="application/pdf"
              aria-label="Policy PDF"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) send(file)
              }}
            />
          </div>
        )}

        {working && (
          <div className="flex flex-col gap-2 rounded-xl border border-brand p-3.5">
            <div className="num text-[11px] text-ink-3">{working}</div>
            <div className="flex items-center gap-2.5 text-[12px] text-ink">
              <span className="size-2 shrink-0 rounded-sm bg-brand" />
              Drafting fields · Haiku
            </div>
          </div>
        )}

        {draft && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow className="text-warn">Extracted · confirm each field</Eyebrow>
              <span className="num truncate text-[10px] text-ink-3">{draft.fileName}</span>
            </div>
            <div className="flex flex-col gap-px border border-rule bg-rule">
              {draft.fields.map((field, i) => {
                const low = field.confidence < LOW_CONFIDENCE
                return (
                  <label
                    key={field.key}
                    className="grid grid-cols-[120px_1fr_auto] items-center gap-3 bg-bg px-3.5 py-2.5"
                  >
                    <span className="text-[12px] text-ink-3">{field.label}</span>
                    <input
                      aria-label={field.label}
                      value={field.value}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev === null
                            ? prev
                            : {
                                ...prev,
                                fields: prev.fields.map((f, j) =>
                                  j === i ? { ...f, value: e.target.value } : f,
                                ),
                              },
                        )
                      }
                      className={cn(
                        'num min-w-0 border-0 border-b bg-transparent py-1 text-[13px] text-ink outline-none focus-visible:border-brand',
                        low ? 'border-warn' : 'border-rule-2',
                      )}
                    />
                    <span
                      title="Extraction confidence"
                      className={cn('num text-[10px]', low ? 'text-warn' : 'text-ink-4')}
                    >
                      {Math.round(field.confidence * 100)}%
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-[11px] text-ink-4">
              Low-confidence fields are amber. The PDF is attached to the policy as its first document.
            </p>
          </>
        )}
      </div>
    </Overlay>
  )
}
