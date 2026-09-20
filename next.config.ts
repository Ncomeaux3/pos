import type { NextConfig } from 'next'

// ponytail: one static CSP with 'unsafe-inline' for Next's hydration scripts.
// Upgrade to per-request nonces in middleware only if this app ever serves
// untrusted content. It is single user and behind auth.
// The browser talks to Supabase Auth directly for the passkey ceremony, so the
// configured origin has to be in connect-src. Hosted projects are under
// supabase.co; the local stack is http://127.0.0.1:54321, which this blocked,
// so a passkey could not be added or used against a dev server until 2026-09-20.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseOrigin =
  supabaseUrl && !new URL(supabaseUrl).hostname.endsWith('.supabase.co')
    ? ` ${new URL(supabaseUrl).origin}`
    : ''

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com" +
    supabaseOrigin,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const nextConfig: NextConfig = {
  // The dev overlay button sits exactly on the sidebar's theme toggle, so it
  // covers the control in every screenshot taken against a dev server.
  devIndicators: false,

  // next dev otherwise appends its own block to CLAUDE.md on every run, which
  // dirties the tree. The pointer it wants to leave is in CLAUDE.md Commands.
  agentRules: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
