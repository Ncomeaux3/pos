import { Eyebrow } from '@/components/pos'
import { guardedToolNames, listTools } from '@/core/mcp'
import { getOrigin } from '@/core/origin'
import { getSetting } from '@/core/settings'
import { AUTONOMY_LABELS, AUTONOMY_LEVELS, type Autonomy } from '@/core/autonomy'
import { SettingsHeader } from '../tabs'
import { AutonomyPicker } from './AutonomyPicker'
import { McpCommand } from './McpCommand'
import { revealMcpToken } from './actions'

const card = 'border border-rule bg-bg-elev px-5 py-[18px]'
const isRead = (name: string) =>
  name.endsWith('.get_digest') || name.endsWith('.query') || name === 'core.search'

export default async function AgentsPage() {
  const [origin, autonomy] = await Promise.all([getOrigin(), getSetting('agent_autonomy')])
  const tools = listTools()
  const guarded = new Set(guardedToolNames())
  const writes = tools.filter((t) => !isRead(t.name))

  return (
    <div className="space-y-[18px]">
      <SettingsHeader current="/settings/agents" />

      <div className="flex max-w-[720px] flex-col gap-3.5">
        <div className={card}>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>MCP endpoint</Eyebrow>
            <span className="inline-flex items-center gap-[7px] text-[11px] tracking-[0.08em] text-ok">
              <span className="size-1.5 rounded-full bg-ok" />
              LIVE · {tools.length} TOOLS
            </span>
          </div>
          <McpCommand origin={origin} reveal={revealMcpToken} />
          <p className="mt-3 text-[12px] leading-[1.5] text-ink-3">
            Set as MCP_TOKEN in .env, which is where infrastructure secrets live. Rotating it means
            changing that value and restarting, or updating the environment variable in Vercel and
            redeploying; the app cannot write its own .env.
          </p>
        </div>

        <div className={card}>
          <Eyebrow>Autonomy</Eyebrow>
          <p className="mt-2 text-[12px] leading-[1.5] text-ink-3">
            How much an agent may do without asking. A write you make in this app is never held
            back, at any level: pressing a button in your own app is the approval.
          </p>
          <div className="mt-3">
            <AutonomyPicker value={autonomy as Autonomy} />
          </div>
          <div className="mt-3">
            {AUTONOMY_LEVELS.map((level) => (
              <div key={level} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 border-b border-rule py-[9px] text-[13px] last:border-b-0">
                <span className="text-ink">{AUTONOMY_LABELS[level]}</span>
                <span className="text-[12px] text-ink-3">
                  {level === 'observe'
                    ? 'Everything an agent does becomes a proposal, including tools no module guarded.'
                    : level === 'propose'
                      ? 'Each module decides. Money, policy and goal writes propose; the rest run.'
                      : 'Nothing is held back. Every write is still logged with its before value, so the Agent Log can undo it.'}
                </span>
                <span className={`num text-[10px] tracking-[0.08em] ${level === autonomy ? 'text-ok' : 'text-ink-4'}`}>
                  {level === autonomy ? 'CURRENT' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <Eyebrow>Guarded tools · agent writes go to Review</Eyebrow>
          <div className="mt-2">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-rule py-[9px] text-[13px]">
              <span className="num text-[12px] text-ink">*.get_digest · *.query · core.search</span>
              <span className="text-[12px] text-ink-3">Read-only, 5s timeout, 500 rows</span>
              <span className="num text-[10px] tracking-[0.08em] text-ok">OPEN</span>
            </div>
            {writes.map((t) => (
              <div key={t.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-rule py-[9px] text-[13px] last:border-b-0">
                <span className="num text-[12px] text-ink">{t.name}</span>
                <span className="max-w-[320px] truncate text-[12px] text-ink-3" title={t.description}>
                  {t.description.replace(/ Guarded: this lands in the review inbox instead of writing\.$/, '')}
                </span>
                <span className={`num text-[10px] tracking-[0.08em] ${guarded.has(t.name) ? 'text-warn' : 'text-ok'}`}>
                  {guarded.has(t.name) ? 'GUARDED' : 'OPEN'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
