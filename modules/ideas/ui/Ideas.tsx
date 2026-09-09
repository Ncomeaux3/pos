'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  ActionButton,
  Card,
  CardHead,
  Chip,
  EmptyState,
  Eyebrow,
  PillGroup,
  Row,
  RowList,
  StatusChip,
  TabBar,
  fieldClass,
  useToast,
} from '@/components/pos'
import { cn } from '@/lib/utils'
import {
  boardOrder,
  LEVEL_LABELS,
  QUADRANT_ADVICE,
  QUADRANT_LABELS,
  quadrant,
  type Level,
} from '../quadrant'
import { captureIdea, moveIdea, scoreIdea, type ActionResult } from './actions'

export type IdeasData = {
  ideas: {
    id: string
    title: string
    pitch: string
    notes: string
    stage: string
    effort: Level
    impact: Level
    killedReason: string
    goalTitle: string | null
    daysSinceTouched: number
  }[]
}

const STAGES = ['exploring', 'validated', 'building', 'killed'] as const

/** Untouched this long and it is not really being explored. */
const STALE_DAYS = 60

export function Ideas({ data }: { data: IdeasData }) {
  const router = useRouter()
  const params = useSearchParams()
  const stage = params.get('stage') ?? 'exploring'
  const open = data.ideas.find((i) => i.id === params.get('idea')) ?? null

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    const query = search.toString()
    router.replace(query ? `?${query}` : '?', { scroll: false })
  }

  const [draft, setDraft] = useState('')
  const [, start] = useTransition()
  const toast = useToast()

  const run = (action: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const result = await action()
      if (!result.ok) toast(result.error)
      else if (ok) toast(ok)
    })

  const shown = boardOrder(data.ideas.filter((i) => i.stage === stage))
  const stale = data.ideas.filter(
    (i) => i.stage === 'exploring' && i.daysSinceTouched >= STALE_DAYS,
  )

  return (
    <div className="space-y-5">
      <TabBar
        label="Idea stages"
        value={stage}
        onChange={(next) => setParams({ stage: next === 'exploring' ? null : next, idea: null })}
        tabs={STAGES.map((s) => ({
          value: s,
          label: s[0].toUpperCase() + s.slice(1),
          count: data.ideas.filter((i) => i.stage === s).length,
        }))}
      />

      <div className="flex flex-wrap gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault()
              run(() => captureIdea(draft), 'Captured')
              setDraft('')
            }
          }}
          aria-label="Capture an idea"
          placeholder="A title, then Enter"
          className={cn(fieldClass, 'min-w-0 flex-1 basis-[260px]')}
        />
        <ActionButton
          variant="brand"
          disabled={!draft.trim()}
          onClick={() => {
            run(() => captureIdea(draft), 'Captured')
            setDraft('')
          }}
        >
          Capture
        </ActionButton>
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
        <div className="min-w-0 flex-[1_1_380px] space-y-4">
          {shown.length === 0 ? (
            <EmptyState headline={stage === 'killed' ? 'Nothing killed' : 'Nothing here'}>
              {stage === 'killed'
                ? 'A killed idea is kept rather than deleted. The reason you dropped it is what stops the same idea arriving again in six months.'
                : 'Capture one above. Score it for effort and impact and the board sorts itself.'}
            </EmptyState>
          ) : (
            <RowList>
              {shown.map((idea) => {
                const q = quadrant(idea.effort, idea.impact)
                return (
                  <Row
                    key={idea.id}
                    title={idea.title}
                    meta={
                      idea.stage === 'killed' && idea.killedReason
                        ? `killed: ${idea.killedReason}`
                        : [
                            idea.pitch,
                            `${LEVEL_LABELS[idea.effort]} effort`,
                            `${LEVEL_LABELS[idea.impact]} impact`,
                            idea.goalTitle ? `toward ${idea.goalTitle}` : '',
                          ]
                            .filter(Boolean)
                            .join(' / ')
                    }
                    selected={open?.id === idea.id}
                    muted={idea.stage === 'killed'}
                    onClick={() => setParams({ idea: idea.id })}
                    right={
                      <Chip tone={q === 'quick-win' ? 'brand' : q === 'money-pit' ? 'bad' : 'quiet'}>
                        {QUADRANT_LABELS[q]}
                      </Chip>
                    }
                  />
                )
              })}
            </RowList>
          )}

          {stage === 'exploring' && stale.length > 0 && (
            <Card className="space-y-2.5">
              <CardHead label="Not moving" meta={`${stale.length}`} />
              <p className="t-caption text-ink-3">
                Untouched for {STALE_DAYS} days or more. Naming that is not the same as killing it,
                so nothing here has been decided for you.
              </p>
              <RowList>
                {stale.map((idea) => (
                  <Row
                    key={idea.id}
                    title={idea.title}
                    meta={`${idea.daysSinceTouched} days`}
                    right={
                      <ActionButton
                        onClick={() =>
                          run(
                            () => moveIdea(idea.id, 'killed', 'Went nowhere for two months.'),
                            'Killed, and kept',
                          )
                        }
                      >
                        Kill it
                      </ActionButton>
                    }
                  />
                ))}
              </RowList>
            </Card>
          )}
        </div>

        {open && (
          <aside className="min-w-0 flex-[1_1_300px] space-y-4 md:max-w-[400px]">
            <Card className="space-y-3">
              <CardHead
                label={QUADRANT_LABELS[quadrant(open.effort, open.impact)]}
                meta={open.stage}
              />
              <h2 className="t-title text-ink">{open.title}</h2>
              {open.pitch && <p className="t-caption text-ink-2">{open.pitch}</p>}

              <p className="t-caption rounded-md border border-rule-2 px-3 py-2 text-ink-3">
                {QUADRANT_ADVICE[quadrant(open.effort, open.impact)]}
              </p>

              <div className="space-y-1.5">
                <Eyebrow>Effort</Eyebrow>
                <PillGroup
                  label={`Effort for ${open.title}`}
                  value={String(open.effort)}
                  options={([1, 2, 3] as Level[]).map((l) => ({
                    value: String(l),
                    label: LEVEL_LABELS[l],
                  }))}
                  onChange={(v) => run(() => scoreIdea(open.id, Number(v), open.impact))}
                />
              </div>

              <div className="space-y-1.5">
                <Eyebrow>Impact</Eyebrow>
                <PillGroup
                  label={`Impact for ${open.title}`}
                  value={String(open.impact)}
                  options={([1, 2, 3] as Level[]).map((l) => ({
                    value: String(l),
                    label: LEVEL_LABELS[l],
                  }))}
                  onChange={(v) => run(() => scoreIdea(open.id, open.effort, Number(v)))}
                />
              </div>

              <div className="space-y-1.5">
                <Eyebrow>Stage</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map((s) => (
                    <ActionButton
                      key={s}
                      variant={open.stage === s ? 'brand' : 'outline'}
                      onClick={() => run(() => moveIdea(open.id, s), `Moved to ${s}`)}
                    >
                      {s}
                    </ActionButton>
                  ))}
                </div>
              </div>

              {open.stage === 'killed' && (
                <div className="space-y-1.5">
                  <Eyebrow>Why</Eyebrow>
                  <input
                    defaultValue={open.killedReason}
                    aria-label={`Why ${open.title} was killed`}
                    placeholder="The reason, so it does not come back"
                    onBlur={(e) =>
                      e.target.value !== open.killedReason &&
                      run(() => moveIdea(open.id, 'killed', e.target.value), 'Noted')
                    }
                    className={cn(fieldClass, 'w-full')}
                  />
                </div>
              )}

              {open.stage === 'building' && (
                <StatusChip tone="brand">This is the one being built</StatusChip>
              )}
            </Card>
          </aside>
        )}
      </div>
    </div>
  )
}
