import { defineIntegration } from '@/core/integrations'

export default defineIntegration({
  id: 'github_vault',
  label: 'Obsidian vault (GitHub)',
  description: 'The private repo holding the Obsidian vault. Second Brain pulls it and proposes commits.',
  docsUrl: 'https://github.com/settings/tokens',

  auth: {
    type: 'token',
    fields: [
      { key: 'repo', label: 'Repository', placeholder: 'nick/obsidian-vault' },
      { key: 'token', label: 'Personal access token', secret: true, placeholder: 'github_pat_...' },
    ],
  },

  // Honest stub: the Second Brain module has not shipped. A real check would
  // read the repo, and the app must never write to the vault without review.
  test: async () => ({
    ok: false,
    detail: 'Not verified. The Second Brain module ships in a later phase and will add a real check.',
  }),
})
