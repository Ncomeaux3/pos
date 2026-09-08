import { EmptyState, PageHeader } from '@/components/pos'

export default function DashboardPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Dashboard / Today"
        dot="idle"
        title="Dashboard"
        lede="The nightly headline and the bento tiles land in step 12, written from module digests only."
      />

      <EmptyState headline="No run yet">
        The orchestrator writes core.dashboard_summary on the nightly run. Until the job runner
        exists there is nothing to read.
      </EmptyState>
    </div>
  )
}
