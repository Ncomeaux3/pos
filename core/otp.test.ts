import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, isCompleteCode, normalizeCode } from './otp'

describe('normalizeCode', () => {
  it('keeps a clean code as it is', () => {
    expect(normalizeCode('483920')).toBe('483920')
  })

  // Every one of these is a real code the owner typed or pasted correctly.
  it('strips what a paste from a mail app brings with it', () => {
    expect(normalizeCode(' 483920 ')).toBe('483920')
    expect(normalizeCode('483 920')).toBe('483920')
    expect(normalizeCode('483-920')).toBe('483920')
    expect(normalizeCode('483 920')).toBe('483920')
    expect(normalizeCode('Code: 483920.')).toBe('483920')
  })

  it('never returns more than the code length, so a paste of the whole email cannot become a guess', () => {
    expect(normalizeCode('4839201234567890')).toHaveLength(CODE_LENGTH)
    expect(normalizeCode('4839201234567890')).toBe('483920')
  })

  it('returns nothing when there are no digits at all', () => {
    expect(normalizeCode('')).toBe('')
    expect(normalizeCode('   ')).toBe('')
    expect(normalizeCode('paste failed')).toBe('')
  })
})

describe('isCompleteCode', () => {
  it('is true only at exactly six digits', () => {
    expect(isCompleteCode('483920')).toBe(true)
    expect(isCompleteCode('483 920')).toBe(true)
    expect(isCompleteCode('48392')).toBe(false)
    expect(isCompleteCode('')).toBe(false)
  })

  // The field submits itself on the sixth digit. A seventh keystroke must not
  // arm it a second time with a code the owner is still editing.
  it('is true for a longer run of digits, which the field has already truncated', () => {
    expect(isCompleteCode('4839201')).toBe(true)
  })
})
