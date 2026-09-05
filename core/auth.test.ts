import { describe, expect, it } from 'vitest'
import { ownerVerdict } from './auth'

const OWNER = 'nick@example.com'

describe('ownerVerdict', () => {
  it('admits the owner', () => {
    expect(ownerVerdict(OWNER, OWNER)).toEqual({ ok: true })
  })

  it('ignores case and surrounding whitespace, which magic link forms produce', () => {
    expect(ownerVerdict('  Nick@Example.COM ', OWNER)).toEqual({ ok: true })
  })

  it('rejects a signed in visitor who is not the owner', () => {
    expect(ownerVerdict('someone@else.com', OWNER)).toEqual({
      ok: false,
      redirectTo: '/not-owner',
    })
  })

  it('sends a signed out visitor to the login page, not the rejection page', () => {
    expect(ownerVerdict(null, OWNER)).toEqual({ ok: false, redirectTo: '/login' })
    expect(ownerVerdict(undefined, OWNER)).toEqual({ ok: false, redirectTo: '/login' })
  })

  // A blank OWNER_EMAIL must never turn into "everyone is the owner". A naive
  // equality check passes when both sides are empty.
  it('admits nobody when OWNER_EMAIL is unset', () => {
    expect(ownerVerdict('anyone@example.com', '')).toEqual({
      ok: false,
      redirectTo: '/not-owner',
    })
    expect(ownerVerdict('', '')).toEqual({ ok: false, redirectTo: '/login' })
    expect(ownerVerdict(null, '   ')).toEqual({ ok: false, redirectTo: '/login' })
  })
})
