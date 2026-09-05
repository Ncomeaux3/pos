import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getModule, missingConnections } from '@/core/modules'

/**
 * Every module page in the app is served from here. A module supplies pages in
 * its manifest and gets routes; it never adds a file under app/.
 *
 * Static segments like /settings win over this dynamic one, so core pages are
 * unaffected.
 */
export default async function ModulePage({ params }: PageProps<'/[module]/[[...path]]'>) {
  const { module: moduleId, path } = await params

  const manifest = getModule(moduleId)
  if (!manifest) notFound()

  const Page = manifest.pages[(path ?? []).join('/')]
  if (!Page) notFound()

  // A module whose provider is not connected shows a prompt rather than a page
  // of empty tables.
  const missing = await missingConnections(manifest.requires ?? [])
  if (missing.length > 0) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{manifest.nav.label}</h1>
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm">
            {manifest.nav.label} needs {missing.join(', ')} connected before it has anything to show.
          </p>
          <Link href="/settings/connections" className="inline-block text-sm underline underline-offset-4">
            Connect {missing.length === 1 ? missing[0] : 'providers'}
          </Link>
        </div>
      </div>
    )
  }

  return <Page />
}
