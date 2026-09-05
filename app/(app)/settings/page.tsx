import { revalidatePath } from 'next/cache'
import { Button } from '@/components/ui/button'
import { getSettings, setSetting } from '@/core/settings'

async function save(formData: FormData) {
  'use server'

  const hour = Number(formData.get('digest_hour'))
  const capDollars = Number(formData.get('llm_soft_cap_dollars'))

  await setSetting('timezone', String(formData.get('timezone') ?? '').trim())
  await setSetting('owner_name', String(formData.get('owner_name') ?? '').trim())
  // Clamp rather than trust the browser: these land in jobs and money maths.
  await setSetting('digest_hour', Math.min(23, Math.max(0, Math.round(hour || 0))))
  await setSetting('llm_soft_cap_cents', Math.max(0, Math.round(capDollars * 100)))

  revalidatePath('/settings')
}

const field = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export default async function SettingsPage() {
  const settings = await getSettings()

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Provider keys live on <a href="/settings/connections" className="underline underline-offset-4">Connections</a>, not here.
        </p>
      </div>

      <form action={save} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="owner_name" className="block text-sm font-medium">
            Owner name
          </label>
          <input id="owner_name" name="owner_name" defaultValue={settings.owner_name} className={field} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="timezone" className="block text-sm font-medium">
            Timezone
          </label>
          <input id="timezone" name="timezone" defaultValue={settings.timezone} className={field} />
          <p className="text-xs text-muted-foreground">An IANA name, for example America/Chicago.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="digest_hour" className="block text-sm font-medium">
            Digest hour
          </label>
          <input
            id="digest_hour"
            name="digest_hour"
            type="number"
            min={0}
            max={23}
            defaultValue={settings.digest_hour}
            className={field}
          />
          <p className="text-xs text-muted-foreground">
            The local hour the digest covers. The cron itself runs at 09:00 UTC and Vercel Hobby
            fires it within the hour.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="llm_soft_cap_dollars" className="block text-sm font-medium">
            Model spend cap
          </label>
          <input
            id="llm_soft_cap_dollars"
            name="llm_soft_cap_dollars"
            type="number"
            min={0}
            step="0.01"
            defaultValue={(settings.llm_soft_cap_cents / 100).toFixed(2)}
            className={field}
          />
          <p className="text-xs text-muted-foreground">
            Dollars per month. Past this, research calls refuse. Classification keeps running.
          </p>
        </div>

        <Button type="submit">Save</Button>
      </form>
    </div>
  )
}
