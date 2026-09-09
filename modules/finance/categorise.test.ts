import { describe, expect, it } from 'vitest'
import { categorise, learnFrom, type Rule } from './categorise'

// "Rules first, model second" is a rule of the whole system, and this is where
// it costs the most: a month of transactions is hundreds of rows, and sending
// every one to a model would be both slow and the largest line on the bill.
//
// So the model is the exception, not the path. Everything here is about how few
// rows reach it.

const rules: Rule[] = [
  { category: 'Groceries', pattern: 'kroger', isManual: false },
  { category: 'Groceries', pattern: 'publix', isManual: false },
  { category: 'Dining', pattern: 'chipotle', isManual: false },
  { category: 'Dining', pattern: 'starbucks', isManual: false },
  { category: 'Subscriptions', pattern: 'anthropic', isManual: false },
  { category: 'Income', pattern: 'payroll', isManual: false },
]

describe('categorise', () => {
  it('matches a rule and says the rule decided it', () => {
    expect(categorise('KROGER #412', rules)).toEqual({
      category: 'Groceries',
      confidence: 1,
      classifiedBy: 'rule',
      matched: 'kroger',
    })
  })

  it('matches case and punctuation insensitively', () => {
    expect(categorise('Chipotle Mexican Grill', rules)?.category).toBe('Dining')
    expect(categorise('STARBUCKS  #1183', rules)?.category).toBe('Dining')
    expect(categorise('anthropic-claude-pro', rules)?.category).toBe('Subscriptions')
  })

  it('returns nothing when no rule matches, rather than guessing', () => {
    // Null is what sends this one row to the model. Returning a low confidence
    // guess here would be the whole cost saving thrown away.
    expect(categorise('Rosie&apos;s Cantina', rules)).toBeNull()
  })

  it('prefers the longest matching pattern, so the specific rule wins', () => {
    const overlapping: Rule[] = [
      { category: 'Shopping', pattern: 'amazon', isManual: false },
      { category: 'Subscriptions', pattern: 'amazon prime', isManual: false },
    ]
    expect(categorise('AMAZON PRIME*2H4KL', overlapping)?.category).toBe('Subscriptions')
    expect(categorise('AMAZON MKTPLACE', overlapping)?.category).toBe('Shopping')
  })

  it('lets a manual rule beat an automatic one of any length', () => {
    // The owner moved Cosmic Coffee to Dining by hand. That decision outranks
    // any pattern a job wrote, which is the manual override rule of the system.
    const mixed: Rule[] = [
      { category: 'Groceries', pattern: 'cosmic coffee roasters', isManual: false },
      { category: 'Dining', pattern: 'cosmic', isManual: true },
    ]
    expect(categorise('Cosmic Coffee Roasters', mixed)).toMatchObject({
      category: 'Dining',
      classifiedBy: 'rule',
    })
  })
})

describe('learnFrom', () => {
  it('turns a correction into a rule', () => {
    const rule = learnFrom('COSMIC COFFEE #3', 'Dining')
    expect(rule).toMatchObject({ category: 'Dining', isManual: true })
    // The stable part of the descriptor, without the store number.
    expect(rule?.pattern).toBe('cosmic coffee')
  })

  it('strips the noise a card processor adds', () => {
    expect(learnFrom('SQ *ROSIES CANTINA 00123', 'Dining')?.pattern).toBe('rosies cantina')
    expect(learnFrom('TST* BIG SPOON CREAMERY', 'Dining')?.pattern).toBe('big spoon creamery')
    expect(learnFrom('PAYPAL *VERCELINC', 'Subscriptions')?.pattern).toBe('vercelinc')
  })

  it('refuses to learn a pattern too short to be safe', () => {
    // A two character pattern would match half the ledger. Better to keep
    // asking than to mis-file everything quietly.
    expect(learnFrom('SQ *AB 0012', 'Dining')).toBeNull()
    expect(learnFrom('12345', 'Dining')).toBeNull()
  })

  it('learns a rule that then matches the thing it came from', () => {
    const rule = learnFrom('WHOLEFDS ABC 10045', 'Groceries')!
    expect(categorise('WHOLEFDS ABC 10045', [rule])?.category).toBe('Groceries')
    // And the next store, which is the point of learning it.
    expect(categorise('WHOLEFDS XYZ 20099', [rule])?.category).toBe('Groceries')
  })
})
