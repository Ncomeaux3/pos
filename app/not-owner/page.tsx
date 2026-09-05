import Link from 'next/link'

export default function NotOwnerPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Not your install</h1>
        <p className="text-sm text-muted-foreground">
          This is a single user system and you are signed in as somebody else.
        </p>
        <Link href="/login" className="inline-block text-sm underline underline-offset-4">
          Sign in as the owner
        </Link>
      </div>
    </main>
  )
}
