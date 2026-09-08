import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { getTheme } from '@/core/theme'
import './globals.css'

// Both are variable fonts, so the weight range comes for free and there is no
// list of weights to keep in sync with the design.
const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'POS',
  description: 'Personal operating system',
}

// The address bar matches the page ground in whichever theme is active.
export const viewport: Viewport = {
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
    <html
      lang="en"
      data-theme={theme}
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
