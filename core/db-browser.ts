import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

// Separate from core/db.ts: that module reaches for next/headers, which cannot
// be bundled for the browser.
export function browserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
