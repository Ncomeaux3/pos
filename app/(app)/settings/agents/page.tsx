import {
  Card,
  CardHead,
  Chip,
  CopyBlock,
  Eyebrow,
  PageHeader,
  Row,
  RowList,
  SecretField,
  StatusChip,
  TabLinks,
} from '@/components/pos'
import { getIntegrations } from '@/core/integrations'
import { guardedToolNames, listToolNames } from '@/core/mcp'
import { getOrigin } from '@/core/origin'
import { getSetting } from '@/core/settings'
import { AUTONOMY_LABELS, AUTONOMY_LEVELS, type Autonomy } from '@/core/autonomy'
import { settingsTabs } from '../tabs'
import { AutonomyPicker } from './AutonomyPicker'
import { revealMcpToken } from './actions'

export default async function AgentsPage() {
  const [origin, autonomy] = await Promise.all([getOrigin(), getSetting('agent_autonomy')])

  const tools = listToolNames()
  const guarded = new Set(guardedToolNames())
  const connected = getIntegrations().length

  const command = `claude mcp add --transport http pos ${origin}/api/mcp --header "Authorization: Bearer $MCP_TOKEN"`

  return (
    <div className="max-w-3xl space-y-7">
      <PageHeader
        eyebrow="Settings / Agents and MCP"
        dot="brand"
        title="Agents and MCP"
        lede="One endpoint, namespaced tools, one bearer token. Claude Code and the Claude app connect here; the orchestrator uses the same registry in process. There is no in-app chat."
        actions={<Eyebrow dot="ok">{tools.length} tools live</Eyebrow>}
      />

      <TabLinks tabs={settingsTabs(connected)} current="/settings/agents" label="Settings sections" />

      <Card className="space-y-4">
        <CardHead label="MCP endpoint" meta={`${tools.length} tools`} />
        <CopyBlock value={command} />
        <div className="space-y-1.5">
          <Eyebrow>Bearer token</Eyebrow>
          <SecretField masked="••••••••••••••••" reveal={revealMcpToken} label="MCP token" />
          <p className="t-caption text-ink-3">
            Set as MCP_TOKEN in .env, which is where infrastructure secrets live. Rotating it means
            changing that value and restarting, or updating the environment variable in Vercel and
            redeploying. There is no button for it here, because the app cannot write its own .env.
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardHead label="Autonomy" meta="core.settings" />
        <p className="t-caption text-ink-3">
          How much an agent may do without asking. A write you make in this app is never held back,
          at any level: pressing a button in your own app is the approval.
        </p>
        <AutonomyPicker value={autonomy as Autonomy} />
      </Card>

      <Card className="space-y-2">
        <CardHead
          label="Tools"
          meta={`${guarded.size} guarded`}
        />
        <p className="t-caption text-ink-3">
          A guarded tool called by an agent writes a proposal to the Review inbox instead of
          touching the table. Reads are never guarded.
        </p>
        <RowList>
          {tools.map((name) => (
            <Row
              key={name}
              title={name}
              meta={name.endsWith('.query') || name === 'core.search' ? 'Read only' : undefined}
              right={
                guarded.has(name) ? (
                  <StatusChip tone="warn">Guarded</StatusChip>
                ) : name.endsWith('.query') || name === 'core.search' ? (
                  <Chip tone="quiet">Read</Chip>
                ) : (
                  <Chip tone="quiet">Write</Chip>
                )
              }
            />
          ))}
        </RowList>
      </Card>

      <Card className="space-y-2">
        <CardHead label="What the levels mean" />
        <RowList>
          {AUTONOMY_LEVELS.map((level) => (
            <Row
              key={level}
              title={AUTONOMY_LABELS[level]}
              meta={
                level === 'observe'
                  ? 'Everything an agent does becomes a proposal, including tools no module guarded. Worth using for the first weeks of a new module.'
                  : level === 'propose'
                    ? 'Each module decides. Money, policy and goal writes propose; the rest run.'
                    : 'Nothing is held back. Every write is still logged with its before value, so the Agent Log can undo it.'
              }
              right={level === autonomy ? <StatusChip tone="ok">Current</StatusChip> : undefined}
            />
          ))}
        </RowList>
      </Card>
    </div>
  )
}
