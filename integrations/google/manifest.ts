import { defineIntegration } from '@/core/integration-contract'
import { calendars, refreshGoogle } from './client'

export default defineIntegration({
  id: 'google',
  label: 'Google',
  description: 'Your Google calendars on the Calendar screen, read only.',
  docsUrl: 'https://console.cloud.google.com/apis/credentials',

  auth: {
    type: 'oauth2',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    // Read only. Phase 7c adds gmail.readonly and asks for one more Connect.
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    scopeSeparator: ' ',
    // offline is what earns a refresh token; consent makes Google send it
    // again on a reconnect rather than only the first time.
    params: { access_type: 'offline', prompt: 'consent' },
  },

  // Lists the calendars, which is both the cheapest call and the answer to
  // "which calendars can POS see".
  test: async (creds) => {
    try {
      const list = await calendars(creds.access_token)
      const names = list.map((c) => c.summary)
      return { ok: true, detail: `${list.length} calendars: ${names.join(', ')}.` }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'Google did not answer.' }
    }
  },

  refresh: refreshGoogle,
  panel: async () => (await import('./ui/CalendarPicker')).CalendarPicker,
})
