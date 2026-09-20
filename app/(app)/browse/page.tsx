import { BandSearch } from '@/components/pos/BandSearch'
import { getNav, NAV_FOOTER } from '@/core/nav'
import { countPending } from '@/core/proposals'
import { Browse } from './Browse'

/**
 * The phone's fourth tab: where every module the bar has no room for lives.
 * Search on top, then the rail's groups: every enabled module, Review and
 * the utilities. A static segment, so it wins over `[module]`.
 */
export default async function BrowsePage() {
  const [nav, reviewCount] = await Promise.all([getNav(), countPending()])
  // Today is the first tab and Search is the band above the list.
  const items = [...nav, ...NAV_FOOTER].filter((n) => n.href !== '/' && n.href !== '/search')

  return (
    <div className="space-y-5">
      <BandSearch className="max-w-none" />
      <h1 className="t-headline text-ink">Browse</h1>
      <Browse items={items} reviewCount={reviewCount} />
    </div>
  )
}
