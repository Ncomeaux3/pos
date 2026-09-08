import { cn } from '@/lib/utils'

// The ComeauxVerse mark: a sliced C in three tapered segments. Copied verbatim
// from ComeauxVerse/brand/logo/comeauxverse-mark-accent.svg, which the brand
// guide says never to hand-edit: the paths are sampled polylines rather than
// arcs, because thickness varies along each segment.
//
// The arms take currentColor so the mark follows the theme's ink. The spine is
// the one segment that carries the accent, never all three.

const ARM_TOP =
  'M 152.3 47.7 L 150.1 45.5 L 147.8 43.5 L 145.4 41.6 L 142.9 39.7 L 140.4 38 L 137.8 36.4 L 135.1 34.8 L 132.4 33.4 L 129.6 32.2 L 126.7 31 L 123.8 29.9 L 120.9 29 L 117.9 28.2 L 114.9 27.5 L 111.9 27 L 108.8 26.5 L 105.8 26.2 L 102.7 26 L 99.6 26 L 96.5 26.1 L 93.5 26.3 L 90.4 26.6 L 87.3 27.1 L 84.3 27.7 L 81.3 28.4 L 78.4 29.2 L 77.6 41.7 L 80.1 40.7 L 82.7 39.9 L 85.4 39.1 L 88.3 38.4 L 91.2 37.8 L 94.3 37.4 L 97.4 37 L 100.6 36.8 L 103.9 36.8 L 107.2 36.9 L 110.5 37.2 L 113.8 37.7 L 117.1 38.3 L 120.4 39.1 L 123.6 40.1 L 126.8 41.3 L 129.9 42.6 L 132.8 44.1 L 135.7 45.7 L 138.4 47.5 L 141 49.3 L 143.5 51.3 L 145.8 53.3 L 147.9 55.4 L 149.8 57.5 L 151.6 59.7 Z'

const SPINE =
  'M 63 35.9 L 58 39.1 L 53.2 42.7 L 48.7 46.6 L 44.6 50.9 L 40.8 55.5 L 37.5 60.4 L 34.5 65.6 L 31.9 71 L 29.8 76.6 L 28.2 82.3 L 27 88.1 L 26.2 94 L 26 100 L 26.2 106 L 27 111.9 L 28.2 117.7 L 29.8 123.4 L 31.9 129 L 34.5 134.4 L 37.5 139.6 L 40.8 144.5 L 44.6 149.1 L 48.7 153.4 L 53.2 157.3 L 58 160.9 L 63 164.1 L 65.2 150.7 L 61.2 147.7 L 57.6 144.6 L 54.3 141.1 L 51.3 137.5 L 48.6 133.8 L 46.2 129.8 L 44.2 125.8 L 42.4 121.6 L 41 117.4 L 39.9 113.1 L 39.1 108.8 L 38.7 104.4 L 38.5 100 L 38.7 95.6 L 39.1 91.2 L 39.9 86.9 L 41 82.6 L 42.4 78.4 L 44.2 74.2 L 46.2 70.2 L 48.6 66.2 L 51.3 62.5 L 54.3 58.9 L 57.6 55.4 L 61.2 52.3 L 65.2 49.3 Z'

const ARM_BOTTOM =
  'M 152.3 152.3 L 150.1 154.5 L 147.8 156.5 L 145.4 158.4 L 142.9 160.3 L 140.4 162 L 137.8 163.6 L 135.1 165.2 L 132.4 166.6 L 129.6 167.8 L 126.7 169 L 123.8 170.1 L 120.9 171 L 117.9 171.8 L 114.9 172.5 L 111.9 173 L 108.8 173.5 L 105.8 173.8 L 102.7 174 L 99.6 174 L 96.5 173.9 L 93.5 173.7 L 90.4 173.4 L 87.3 172.9 L 84.3 172.3 L 81.3 171.6 L 78.4 170.8 L 77.6 158.3 L 80.1 159.3 L 82.7 160.1 L 85.4 160.9 L 88.3 161.6 L 91.2 162.2 L 94.3 162.6 L 97.4 163 L 100.6 163.2 L 103.9 163.2 L 107.2 163.1 L 110.5 162.8 L 113.8 162.3 L 117.1 161.7 L 120.4 160.9 L 123.6 159.9 L 126.8 158.7 L 129.9 157.4 L 132.8 155.9 L 135.7 154.3 L 138.4 152.5 L 141 150.7 L 143.5 148.7 L 145.8 146.7 L 147.9 144.6 L 149.8 142.5 L 151.6 140.3 Z'

export function ComeauxverseMark({
  size = 28,
  accent = true,
  className,
}: {
  size?: number
  /**
   * The accent spine. Off below 20px, where the brand guide says the green is
   * at the limit of legibility and the mono mark is the correct one.
   */
  accent?: boolean
  className?: string
}) {
  const spineFill = accent && size >= 20 ? 'var(--accent)' : 'currentColor'

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label="ComeauxVerse"
      className={cn('shrink-0', className)}
    >
      <path d={ARM_TOP} fill="currentColor" />
      <path d={SPINE} fill={spineFill} />
      <path d={ARM_BOTTOM} fill="currentColor" />
    </svg>
  )
}

/**
 * Mark plus wordmark. The lockup carries its accent on VERSE, and the mark
 * stays mono there, because the brand allows one accent element per frame.
 * Manrope 500 tracked 0.28em is the wordmark, not a substitutable face.
 */
export function ComeauxverseLockup({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-ink', className)}>
      <ComeauxverseMark size={22} accent={false} />
      <span className="font-brand text-[13px] font-medium leading-none tracking-[0.28em] text-ink">
        COMEAUX<span className="text-brand">VERSE</span>
      </span>
    </span>
  )
}
