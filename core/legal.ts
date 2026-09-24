// The facts every legal page states, in one place, so a change of address or
// email is one edit and the three documents never disagree.

export const LEGAL = {
  product: 'Holon',
  /** The person users agree with. An individual, not a company (owner's answer, 2026-09-23). */
  operator: 'Nick Comeaux',
  email: 'nicholascomeaux00@gmail.com',
  address: '521 Davis Cir SW, Huntsville, Alabama 35801',
  governingState: 'Alabama',
  site: 'https://pos-gilt-rho.vercel.app',
  /** The date these versions took effect. Change it with any material edit. */
  effective: 'September 24, 2026',
} as const

/** The three documents, in the order every legal nav lists them. */
export const LEGAL_DOCS = [
  { href: '/terms', label: 'Terms of service' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/privacy/health', label: 'Consumer health data' },
] as const
