import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ownerVerdict, requireOwner } from './auth'

const OWNER = 'nick@example.com'

// redirect() throws in Next so control never returns; the mock keeps that shape.
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to)
  },
}))

const getUser = vi.fn()
vi.mock('./db', () => ({
  serverClient: async () => ({ auth: { getUser } }),
}))

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

describe('requireOwner', () => {
  beforeEach(() => {
    getUser.mockReset()
    process.env.OWNER_EMAIL = OWNER
  })

  const signedInAs = (email: string | null) =>
    getUser.mockResolvedValue({ data: { user: email ? { id: 'u1', email } : null } })

  it('returns the owner when the session belongs to them', async () => {
    signedInAs(OWNER)
    await expect(requireOwner()).resolves.toMatchObject({ email: OWNER })
  })

  it('sends another signed in address to the rejection page', async () => {
    signedInAs('someone@else.com')
    await expect(requireOwner()).rejects.toThrow('redirect:/not-owner')
  })

  it('sends a signed out visitor to the login page', async () => {
    signedInAs(null)
    await expect(requireOwner()).rejects.toThrow('redirect:/login')
  })

  it('locks out even a valid session when OWNER_EMAIL is unset', async () => {
    process.env.OWNER_EMAIL = ''
    signedInAs('anyone@example.com')
    await expect(requireOwner()).rejects.toThrow('redirect:/not-owner')
  })
})
