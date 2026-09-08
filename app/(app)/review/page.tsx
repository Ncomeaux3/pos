import { Eyebrow, PageHeader, TabLinks } from '@/components/pos'
import { getModule } from '@/core/modules'
import { listProposals, type Proposal, type ProposalStatus } from '@/core/proposals'
import { ReviewList, type ReviewItem } from './ReviewList'
import { ApproveAll } from './ApproveAll'

// The three the screen shows. 'rejected' is a fourth stored status kept for
// rows decided before dismissal existed; it has no tab and nothing writes it.
type ReviewTab = Extract<ProposalStatus, 'pending' | 'approved' | 'dismissed'>

const TABS: ReviewTab[] = ['pending', 'approved', 'dismissed']

function isTab(value: unknown): value is ReviewTab {
  return typeof value === 'string' && (TABS as string[]).includes(value)
}

/** Relative age, which is what the card shows rather than a timestamp. */
function age(at: Date): string {
  const minutes = Math.round((Date.now() - new Date(at).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function toItem(p: Proposal): ReviewItem {
  return {
    id: p.id,
    module: p.module,
    moduleLabel: getModule(p.module)?.nav.label ?? p.module,
    tool: p.tool,
    title: p.title ?? `${p.module}.${p.tool}`,
    agent: p.agent ?? 'agent',
    reason: p.reason ?? 'No reason given.',
    confidence: p.confidence === null ? null : Number(p.confidence),
    evidence: p.evidence,
    affects: p.affects,
    guarded: p.guarded,
    diff: p.diff,
    status: p.status,
    age: age(p.createdAt),
  }
}

export default async function ReviewPage({ searchParams }: PageProps<'/review'>) {
  const params = await searchParams
  const status: ReviewTab = isTab(params.tab) ? params.tab : 'pending'

  const [pending, approved, dismissed] = await Promise.all([
    listProposals('pending'),
    listProposals('approved'),
    listProposals('dismissed'),
  ])

  const byStatus = { pending, approved, dismissed }
  const items = byStatus[status].map(toItem)
  const unguarded = pending.filter((p) => !p.guarded).length

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`Review / ${status}`}
        dot={pending.length > 0 ? 'warn' : 'ok'}
        title="Review"
        lede="Everything an agent wants to change. Nothing here touches your data until you approve it."
        actions={
          <>
            <Eyebrow dot={pending.length > 0 ? 'warn' : 'ok'}>{pending.length} pending</Eyebrow>
            {status === 'pending' && unguarded > 0 && <ApproveAll count={unguarded} />}
          </>
        }
      />

      <TabLinks
        label="Proposal status"
        current={`/review?tab=${status}`}
        tabs={TABS.map((t) => ({
          href: `/review?tab=${t}`,
          label: t[0].toUpperCase() + t.slice(1),
          count: byStatus[t].length,
        }))}
      />

      <ReviewList items={items} status={status} />
    </div>
  )
}
