import { EmptyState, PageHeader, TabLinks } from '@/components/pos'
import { getIntegrations } from '@/core/integrations'
import { getModule } from '@/core/modules'
import { loadMergedTree, loadOverrides } from '@/modules/skills/tree'
import { settingsTabs } from '../tabs'
import { SkillsEditor } from './SkillsEditor'

export default async function SkillsSettingsPage() {
  // The tab is only reachable while the module that owns the tree is installed.
  if (!getModule('skills')) {
    return (
      <div className="max-w-3xl space-y-7">
        <PageHeader eyebrow="Settings / Skills" title="Skills" lede="No module owns the skill tree." />
        <EmptyState headline="Skill Tree is not installed">
          The tree, its keywords and its XP weights live in modules/skills. Without that folder
          nothing classifies, and there is nothing here to edit.
        </EmptyState>
      </div>
    )
  }

  const [tree, overrides] = await Promise.all([loadMergedTree(), loadOverrides()])
  const live = tree.filter((s) => !s.deleted)

  // Grouped under the attribute each skill hangs from, however deep it sits.
  const attributeOf = (id: string): string => {
    const node = tree.find((n) => n.id === id)
    return node?.parent ? attributeOf(node.parent) : id
  }

  const groups = tree
    .filter((s) => !s.parent)
    .map((attribute) => ({
      attribute,
      skills: tree.filter((s) => s.parent && attributeOf(s.id) === attribute.id),
    }))

  return (
    <div className="max-w-3xl space-y-7">
      <PageHeader
        eyebrow="Settings / Skills"
        dot="brand"
        title="Skills"
        lede="Every skill a task, note, or workout can link to. Rename inline; delete what you will not use. Changes apply everywhere and never touch XP already earned, because events keep their own link."
        actions={<span className="num text-[11px] text-ink-3">{live.length} skills</span>}
      />

      <TabLinks
        tabs={settingsTabs(getIntegrations().length, live.length)}
        current="/settings/skills"
        label="Settings sections"
      />

      <SkillsEditor groups={groups} overrideCount={overrides.length} />

      <p className="text-[12px] text-ink-3">
        modules/skills/skills.yaml is the committed default and stays generic, so a fork gets a
        usable tree and none of yours. Everything you change here is a row in skills.override, which
        is also why the tree is editable in production: the filesystem there is read only.
      </p>
    </div>
  )
}
