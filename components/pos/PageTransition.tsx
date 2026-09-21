'use client'

import { usePathname } from 'next/navigation'
import { ViewTransition, type ReactNode } from 'react'
import { useIsPhone } from './useIsPhone'

/**
 * The page column, and on the phone the thing that pushes and pops.
 *
 * Keyed by pathname, so a route change is an exit and an enter pair and
 * nothing else is: a drawer (?task=), a view switch (?view=, replaceState)
 * and router.refresh() keep the same key and the boundary's own default of
 * "none" leaves them alone. The transition types map to the classes the CSS
 * in app/globals.css animates below md; the desktop keeps the .reveal
 * stagger and resolves every class to none, so no transition starts there.
 *
 * Forward is the untyped case, which is every plain link. The capsule tags
 * its navigations `tab`. Back is not a type here at all: React flushes any
 * transition started inside a popstate event synchronously (so scroll can be
 * restored before paint), and a synchronous commit never starts a view
 * transition. goBack() below runs that case through the browser's own API
 * instead, and the page's static view-transition-name is what it animates.
 */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname()
  const phone = useIsPhone()

  return (
    <ViewTransition
      key={pathname}
      enter={phone ? { tab: 'vt-fade', default: 'vt-push-in' } : 'none'}
      exit={phone ? { tab: 'vt-fade', default: 'vt-push-out' } : 'none'}
      default="none"
    >
      <div className={className}>{children}</div>
    </ViewTransition>
  )
}

/**
 * history.back() as an iOS pop. The browser snapshots the page, the router
 * restores the previous entry inside the update callback, and the CSS under
 * html[data-nav="back"] slides the old page off over the new one.
 *
 * The leaving page is renamed inline for the duration so the old and the new
 * page are two groups, as they are on the way forward, rather than one group
 * morphing from the old box to the new: a scrolled page would drift up the
 * screen while it slid. When the entry behind is the same route (a drawer
 * closing under an edge drag) the transition is skipped inside the update,
 * so the page that stays does not slide off under its own name. No history
 * to go back to is the no-op it always was, not a callback waiting on a
 * popstate that never comes. A browser without the API goes straight back
 * with no animation, which is the accepted fallback; the try covers one that
 * has it and refuses the call.
 */
export function goBack() {
  const html = document.documentElement
  const page = document.querySelector<HTMLElement>('.page')
  if (window.history.length <= 1) return
  if (typeof document.startViewTransition !== 'function' || html.dataset.nav || !page) {
    return window.history.back()
  }
  const from = window.location.pathname
  html.dataset.nav = 'back'
  page.style.viewTransitionName = 'leaving'
  const reset = () => {
    delete html.dataset.nav
    // The same element when the route did not change; a no-op otherwise.
    page.style.removeProperty('view-transition-name')
  }
  try {
    const transition = document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          window.addEventListener(
            'popstate',
            () => {
              if (window.location.pathname === from) transition.skipTransition()
              resolve()
            },
            { once: true },
          )
          window.history.back()
        }),
    )
    // A skipped transition rejects `ready`, and nobody here needs it.
    transition.ready.catch(() => {})
    transition.finished.finally(reset)
  } catch {
    reset()
    window.history.back()
  }
}
