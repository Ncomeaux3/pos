import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ComeauxverseLockup, Eyebrow, fieldClass } from '@/components/pos'
import { ownerVerdict } from '@/core/auth'
import { serverClient } from '@/core/db'
import { getOrigin } from '@/core/origin'
import { Countdown } from './Countdown'
import { SubmitButton } from './SubmitButton'

// Matches supabase/config.toml auth.email.otp_expiry.
const LINK_TTL_SECONDS = 900

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function sendMagicLink(formData: FormData) {
  'use server'

  const email = String(formData.get('email') ?? '').trim()
  if (!EMAIL.test(email)) {
    // Hand the typed value back so the field is not cleared on a typo.
    redirect(`/login?error=invalid&email=${encodeURIComponent(email)}`)
  }

  const verdict = ownerVerdict(email, process.env.OWNER_EMAIL ?? '')

  // Only the owner ever gets a link, and the reply is the same either way, so
  // the page never confirms which address owns this install. The design's
  // denied screen would answer exactly the question an attacker is asking.
  if (verdict.ok) {
    const supabase = await serverClient()
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${await getOrigin()}/auth/callback`,
        // No signup flow: one owner, created by pnpm setup.
        shouldCreateUser: false,
      },
    })
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`)
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const sent = params.sent === '1'
  const error = typeof params.error === 'string' ? params.error : null

  // Reflected onto the page, so it is only shown when it really is an address.
  const raw = typeof params.email === 'string' ? params.email : ''
  const email = EMAIL.test(raw) && raw.length <= 254 ? raw : ''

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The artboard's top band: the lockup, and what this install is. */}
      <header className="flex h-14 shrink-0 flex-wrap items-center justify-between gap-3 px-7">
        <ComeauxverseLockup className="h-5 text-ink" />
        <Eyebrow dot="brand">POS / single owner / v0.1</Eyebrow>
      </header>

      <main className="grid flex-1 place-items-center p-6">
      <div className="w-full max-w-[440px] border border-rule-2 bg-bg-elev p-9 pb-7">
        {sent ? (
          <div className="space-y-5">
            <div className="space-y-3">
              <Eyebrow dot="ok">Link sent</Eyebrow>
              <h1 className="t-headline text-ink">Check your inbox</h1>
              <p className="t-caption text-ink-3">
                If that address owns this install, a single-use sign in link is on its way
                {email && (
                  <>
                    {' '}
                    to <span className="text-ink-2">{email}</span>
                  </>
                )}
                .
              </p>
            </div>

            <div className="flex items-baseline justify-between border-y border-rule py-3">
              <span className="label text-[10px] tracking-[0.1em] text-ink-3">Expires</span>
              <span className="num text-[13px]">
                <Countdown seconds={LINK_TTL_SECONDS} />
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/login" className="text-[13px] text-ink-3 transition-colors hover:text-ink">
                Use a different email
              </Link>
              <form action={sendMagicLink}>
                <input type="hidden" name="email" value={email} />
                <button
                  type="submit"
                  className="label text-[10px] tracking-[0.1em] text-ink-3 transition-colors hover:text-ink"
                >
                  Resend
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* The artboard's order: what you are doing is the eyebrow, what
              * you are signing in to is the heading. */}
            <div className="space-y-3">
              <Eyebrow>Sign in</Eyebrow>
              <h1 className="text-[30px] font-normal leading-[1.05] tracking-[-0.03em] text-ink">
                Personal Operating System
              </h1>
              <p className="t-caption text-ink-3">
                One owner, one login. Enter the owner email and a single-use link comes back.
              </p>
            </div>

            <form action={sendMagicLink} className="space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="label block text-[10px] tracking-[0.1em] text-ink-3"
                >
                  Owner email
                </label>
                <div className="flex items-center gap-2 rounded-md border border-rule-2 bg-bg-deep px-2.5 focus-within:border-brand">
                  <span aria-hidden className="code text-[13px] text-ink-4">
                    &gt;
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    defaultValue={error === 'invalid' ? raw : ''}
                    className={`${fieldClass} border-0 bg-transparent px-0`}
                  />
                </div>
                {error === 'invalid' && (
                  <p className="label text-[10px] tracking-[0.1em] text-bad">
                    Enter a valid email
                  </p>
                )}
                {error === 'expired' && (
                  <p className="label text-[10px] tracking-[0.1em] text-bad">
                    That link expired. Ask for another.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <SubmitButton idle="Send sign-in link" busy="Sending" />
              </div>
            </form>

            <div className="flex flex-wrap justify-between gap-2 border-t border-rule pt-3">
              <span className="label text-[10px] tracking-[0.1em] text-ink-4">
                Link expires in 15 min
              </span>
              <span className="label text-[10px] tracking-[0.1em] text-ink-4">
                No passwords · no signup
              </span>
            </div>
          </div>
        )}
      </div>
      </main>
    </div>
  )
}
