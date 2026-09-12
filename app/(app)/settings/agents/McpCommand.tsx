'use client'

import { useState } from 'react'

/**
 * The paste-able command with the token inline, masked until asked for. The
 * secret is fetched on the first reveal, so it is not in the HTML of a screen
 * left open on a second monitor.
 */
export function McpCommand({ origin, reveal }: { origin: string; reveal: () => Promise<string> }) {
  const [token, setToken] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (shown) return setShown(false)
    if (token === null) {
      setBusy(true)
      setToken(await reveal())
      setBusy(false)
    }
    setShown(true)
  }

  return (
    <>
      <pre className="num mt-3 overflow-auto whitespace-pre border border-rule bg-bg-deep px-3.5 py-3 text-[12px] leading-[1.7] text-ink-2">
        {`claude mcp add --transport http pos ${origin}/api/mcp \\\n  --header "Authorization: Bearer ${shown && token !== null ? token || '(MCP_TOKEN is not set)' : '••••••••••••••••••••'}"`}
      </pre>
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={toggle}
          className="border border-rule-2 px-3.5 py-2 text-[13px] text-ink transition-colors duration-150 hover:bg-ink hover:text-bg"
        >
          {shown ? 'Hide token' : 'Reveal token'}
        </button>
      </div>
    </>
  )
}
