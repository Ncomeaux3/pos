import { embedChanged } from '@/core/search'
import { seed } from '@/modules/notes/seed'

// Run by the Playwright setup project before any screen test. The vitest suite
// truncates core.entities, so the e2e run cannot rely on whatever a previous
// command happened to leave behind: it seeds and indexes its own fixture.
const notes = await seed()
const index = await embedChanged()

console.log(`seeded ${notes} notes, indexed ${index.indexed}, embedded ${index.embedded}`)
process.exit(0)
