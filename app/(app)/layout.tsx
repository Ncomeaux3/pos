import Link from 'next/link'
import { requireOwner } from '@/core/auth'
import { getModules } from '@/core/modules'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const owner = await requireOwner()

  // Dashboard and Settings are core; everything between them comes from the
  // module manifests, so adding a module folder adds its nav entry.
  const NAV = [
    { href: '/', label: 'Dashboard' },
    ...getModules().map((m) => ({ href: `/${m.id}`, label: m.nav.label })),
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-56 shrink-0 border-r border-border p-4 sm:block">
        <Link href="/" className="mb-6 block text-sm font-semibold tracking-tight">
          POS
        </Link>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 truncate text-xs text-muted-foreground" title={owner.email}>
          {owner.email}
        </p>
      </aside>

      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  )
}
