import { BandSearch } from '@/components/pos/BandSearch'
import { getNav } from '@/core/nav'
import { countPending } from '@/core/proposals'
import { Browse } from './Browse'

/**
 * The phone's fourth tab: where every module the bar has no room for lives.
 * Search on top, one row per enabled module, then the app's own pages. A
 * static segment, so it wins over `[module]`.
 */
export default async function BrowsePage() {
  const [nav, reviewCount] = await Promise.all([getNav(), countPending()])
  const modules = nav.filter((n) => n.href !== '/' && n.href !== '/review')

  return (
    <div className="space-y-5">
      <BandSearch className="max-w-none" />
      <h1 className="t-headline text-ink">Browse</h1>
      <Browse modules={modules} reviewCount={reviewCount} />
    </div>
  )
}
