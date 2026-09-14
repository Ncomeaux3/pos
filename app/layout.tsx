import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { getTheme } from '@/core/theme'
import './globals.css'

// One family, per ComeauxVerse/brand/visual.md: Manrope 400 to 700, no
// monospace anywhere. It is a variable font, so the whole weight range arrives
// in one file and there is no weight list to keep in sync with the guide.
const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'POS',
  description: 'Personal operating system',
}

// The address bar matches the page ground in whichever theme is active.
export const viewport: Viewport = {
  // Cover, so env(safe-area-inset-*) reads the home indicator instead of zero.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#07080A' },
    { media: '(prefers-color-scheme: light)', color: '#F4F2EC' },
  ],
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Written on the server so the first paint is already the right theme. Both
  // @custom-variant selectors key off this attribute, so it is never absent.
  const theme = await getTheme()

  return (
    <html lang="en" data-theme={theme} className={`${manrope.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
