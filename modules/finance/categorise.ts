// Transaction categorisation. No imports: the Finance screen is a client
// component and anything reaching core/db.ts drags pg into the browser bundle.
//
// Rules first, model second. A month is hundreds of transactions and almost all
// of them are merchants you have seen before, so the job of this file is to
// leave as little as possible for a model call. Returning null is the whole
// interface to that: null means "ask the model", and everything here exists to
// return null less often.

export type Rule = {
  category: string
  /** Already normalised: lowercase, single spaced. */
  pattern: string
  /** True when the owner's own correction wrote it. Beats any automatic rule. */
  isManual: boolean
}

export type Match = {
  category: string
  confidence: number
  classifiedBy: 'rule'
  /** Which pattern hit, so the UI can say why. */
  matched: string
}

/** Lowercase, punctuation to spaces, runs of space collapsed. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * The prefixes card processors staple onto a descriptor. Stripping them is what
 * turns "SQ *ROSIES CANTINA 00123" into a merchant rather than a receipt.
 */
const PROCESSOR_PREFIXES = /^(sq|tst|sp|pp|paypal|pos|dd|ext|pymt|purchase)\s+/

/**
 * Strip the trailing reference, then the store code hiding in front of it.
 *
 * "wholefds abc 10045" has to become "wholefds", or the learned rule matches
 * one branch and asks again at the next. But "big spoon creamery" has to
 * survive intact, and a rule that simply dropped short trailing tokens would
 * eat it.
 *
 * The distinguishing fact is the number: a short token is a store code only
 * when a reference number followed it. Drop the numeric tail first, and only
 * then drop a short token that the tail was sitting behind.
 */
function stripReference(pattern: string): string {
  const tokens = pattern.split(' ').filter(Boolean)

  let droppedNumber = false
  while (tokens.length > 0 && /\d/.test(tokens[tokens.length - 1])) {
    tokens.pop()
    droppedNumber = true
  }

  if (droppedNumber && tokens.length > 1 && tokens[tokens.length - 1].length <= 3) {
    tokens.pop()
  }

  return tokens.join(' ')
}

/** Shorter than this matches too much of the ledger to be safe to learn. */
const MIN_PATTERN_LENGTH = 4

/**
 * The first rule that matches, ranked.
 *
 * Manual before automatic, then longest first. Manual wins outright because the
 * owner's correction is the one fact in the system that a job may never
 * overwrite; length breaks the rest, so "amazon prime" beats "amazon" and the
 * specific rule is the one that fires.
 */
export function categorise(descriptor: string, rules: Rule[]): Match | null {
  const text = normalise(descriptor)

  const ranked = [...rules].sort((a, b) => {
    if (a.isManual !== b.isManual) return a.isManual ? -1 : 1
    return b.pattern.length - a.pattern.length
  })

  for (const rule of ranked) {
    if (text.includes(rule.pattern)) {
      return {
        category: rule.category,
        // A rule is a fact, not an estimate. Only the model arm produces a
        // confidence below one, which is what makes the number meaningful.
        confidence: 1,
        classifiedBy: 'rule',
        matched: rule.pattern,
      }
    }
  }

  return null
}

/**
 * Turn a correction into a rule, so the same merchant is never asked about
 * twice.
 *
 * This is the cheapest thing in the module: every rule learned here is a model
 * call not made next month. It is also the riskiest, which is why the pattern
 * has to survive both the processor prefix and the store number before it is
 * kept, and why anything too short is refused outright. A bad rule mis-files
 * quietly, and quiet is the failure mode worth spending code to avoid.
 */
export function learnFrom(descriptor: string, category: string): Rule | null {
  let pattern = normalise(descriptor)

  // Strip repeatedly: "sq tst rosies" is not a merchant either.
  let previous = ''
  while (pattern !== previous) {
    previous = pattern
    pattern = pattern.replace(PROCESSOR_PREFIXES, '').trim()
  }

  pattern = stripReference(pattern)

  // A descriptor that is only digits leaves nothing to learn.
  if (pattern.length < MIN_PATTERN_LENGTH || !/[a-z]/.test(pattern)) return null

  return { category, pattern, isManual: true }
}
