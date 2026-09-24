import { revalidatePath } from 'next/cache'
import { ActionButton, Eyebrow } from '@/components/pos'
import { requireOwner } from '@/core/auth'
import { getCredentials, updateCredentials } from '@/core/credentials'
import { calendars, googleCredentials, pickedIds } from '../client'

// Which Google calendars the nightly pull reads. Kept in the connection's own
// credentials, beside the token, so the choice leaves with a disconnect.

async function save(formData: FormData) {
  'use server'
  await requireOwner()
  const creds = await getCredentials('google')
  if (!creds) return
  const ids = formData.getAll('calendar').map(String)
  await updateCredentials('google', { ...creds, calendars: JSON.stringify(ids) })
  revalidatePath('/settings/connections')
}

export async function CalendarPicker() {
  // The refresh is inside the try: a revoked grant throws there, and the
  // page it would take down holds the Reauthorize and Disconnect buttons.
  let creds: Awaited<ReturnType<typeof googleCredentials>>
  let list: Awaited<ReturnType<typeof calendars>>
  try {
    creds = await googleCredentials()
    if (!creds) return null
    list = await calendars(creds.access_token)
  } catch (error) {
    return (
      <p className="glass mt-2.5 rounded-[18px] px-4 py-3 text-[12px] leading-[1.5] text-ink-3">
        Could not list your calendars. {error instanceof Error ? error.message : 'Google did not answer.'}
      </p>
    )
  }
  if (list.length === 0) {
    return (
      <p className="glass mt-2.5 rounded-[18px] px-4 py-3 text-[12px] leading-[1.5] text-ink-3">
        This Google account has no calendars to show.
      </p>
    )
  }
  const picked = new Set(pickedIds(creds, list))

  return (
    <form action={save} className="glass mt-2.5 rounded-[18px] px-4 py-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2">
          <Eyebrow>Calendars to show</Eyebrow>
        </legend>
        {list.map((c) => (
          <label key={c.id} className="flex items-center gap-2.5 text-[13px] text-ink">
            <input
              type="checkbox"
              name="calendar"
              value={c.id}
              defaultChecked={picked.has(c.id)}
              className="accent-action"
            />
            <span className="min-w-0 break-words">{c.summary}</span>
          </label>
        ))}
        <div className="flex items-center gap-2.5">
          <ActionButton type="submit">Save calendars</ActionButton>
          <span className="t-caption text-ink-3">Next sync uses the new list</span>
        </div>
      </fieldset>
    </form>
  )
}
