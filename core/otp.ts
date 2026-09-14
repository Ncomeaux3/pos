// The six digit code from the sign in email. Kept here, pure, so the rules
// about what counts as a code can be tested without a session or a server.

export const CODE_LENGTH = 6

/**
 * What the owner typed, reduced to what Supabase will accept.
 *
 * Phones are the reason this exists. Mail's autofill hands over the code with
 * whatever punctuation surrounded it in the sentence, a paste from the message
 * brings a trailing space or a non breaking one, and some keyboards insert a
 * thin space every three digits. Every one of those is the right code typed by
 * a person who would then be told it was wrong.
 */
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

/** A code that is worth spending a verification attempt on. */
export function isCompleteCode(input: string): boolean {
  return normalizeCode(input).length === CODE_LENGTH
}
