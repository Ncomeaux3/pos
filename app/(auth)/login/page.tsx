import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ownerVerdict } from '@/core/auth'
import { serverClient } from '@/core/db'

async function sendMagicLink(formData: FormData) {
  'use server'

  const email = String(formData.get('email') ?? '')
  const verdict = ownerVerdict(email, process.env.OWNER_EMAIL ?? '')

  // Only the owner ever gets a link. The reply is the same either way so the
  // page never confirms which address owns this install.
  if (verdict.ok) {
    const origin = (await headers()).get('origin') ?? ''
    const supabase = await serverClient()
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        // No signup flow: one owner, created by pnpm setup.
        shouldCreateUser: false,
      },
    })
  }

  redirect('/login?sent=1')
}

export default async function LoginPage({
  searchParams,
}: PageProps<'/login'>) {
  const params = await searchParams
  const sent = params.sent === '1'
  const error = typeof params.error === 'string' ? params.error : null

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
          <p className="text-sm text-muted-foreground">Personal operating system</p>
        </div>

        {sent ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            If that address owns this install, a sign in link is on its way. The link
            expires in an hour.
          </p>
        ) : (
          <form action={sendMagicLink} className="space-y-3">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button type="submit" className="w-full">
              Send sign in link
            </Button>
          </form>
        )}

        {error === 'expired' && (
          <p className="text-sm text-destructive">
            That link has expired or was already used. Request a new one.
          </p>
        )}
        {error === 'missing_code' && (
          <p className="text-sm text-destructive">
            That link was incomplete. Request a new one.
          </p>
        )}
      </div>
    </main>
  )
}
