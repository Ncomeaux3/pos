import { defineIntegration } from '@/core/integration-contract'

export default defineIntegration({
  id: 'simplefin',
  label: 'SimpleFIN Bridge',
  description: 'Bank balances and transactions for the Finance module. $1.50/mo or $15/yr.',
  docsUrl: 'https://beta-bridge.simplefin.org/',

  auth: {
    type: 'token',
    fields: [
      {
        key: 'access_url',
        label: 'Access URL',
        secret: true,
        // The base64 setup token is claimed once and exchanged for this
        // (verified 2026-09-05). Store the result, not the setup token.
        placeholder: 'https://user:pass@bridge.simplefin.org/simplefin',
      },
    ],
  },

  // Honest stub: the Finance module has not shipped, so nothing here has been
  // exercised against the real API. Saving a value is not a claim that it works.
  test: async () => ({
    ok: false,
    detail: 'Not verified. The Finance module ships in a later phase and will add a real check.',
  }),
})
