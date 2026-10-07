import { useEffect, useState } from 'react'

// Minimal path routing for the few public screens (landing, sign in, request access, legal pages).
// The signed in console is not routed: it is one screen with tabs, as before.
// Vercel rewrites every path to index.html (vercel.json), and Vite's dev server does the same,
// so a reload or a bookmark of /sign-in works.

export const ROUTES = {
  landing: '/',
  signIn: '/sign-in',
  requestAccess: '/request-access',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  accessibility: '/accessibility',
  howItWorks: '/how-it-works',
  security: '/security',
  about: '/about',
}

// Pages anyone can read, signed in or not. They have an address of their own even for a signed in person.
export const LEGAL_ROUTES = [ROUTES.privacy, ROUTES.terms, ROUTES.cookies, ROUTES.accessibility]
export const isLegalPath = (path) => LEGAL_ROUTES.includes(path)

// The public information pages linked from the landing page header. Like the legal pages, anyone can read
// them, signed in or not.
export const INFO_ROUTES = [ROUTES.howItWorks, ROUTES.security, ROUTES.about]
export const isInfoPath = (path) => INFO_ROUTES.includes(path)

const NAV_EVENT = 'screening:navigate'

// True once this page has moved between screens by itself (a click, not a fresh load). A screen uses it to
// decide whether to move focus and scroll to the top: on a fresh load that would break keyboard order
// (the skip link and header would be skipped) and deep links such as /#security.
let navigated = false
export const arrivedByNavigation = () => navigated

/** '/Sign-In/' -> '/sign-in'. Query string and hash are not part of the route. */
function normalizePath(pathname) {
  const trimmed = String(pathname || '/').replace(/\/+$/, '')
  return (trimmed || '/').toLowerCase()
}

function currentPath() {
  return normalizePath(window.location.pathname)
}

export function navigate(to, { replace = false } = {}) {
  if (normalizePath(to) === currentPath() && window.location.hash === '') return
  if (!replace) navigated = true
  window.history[replace ? 'replaceState' : 'pushState'](null, '', to)
  window.dispatchEvent(new Event(NAV_EVENT))
}

/** The current route path, kept up to date on navigate() and on the browser's back and forward buttons. */
export function usePath() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const update = () => setPath(currentPath())
    window.addEventListener('popstate', update)
    window.addEventListener(NAV_EVENT, update)
    update()
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(NAV_EVENT, update)
    }
  }, [])
  return path
}

/**
 * A real link (right click, middle click, "open in new tab" and copy address all work) that moves
 * within the app without a page load when it is a plain left click.
 */
export function Link({ to, onClick, children, ...rest }) {
  function handle(e) {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (rest.target && rest.target !== '_self') return
    e.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handle} {...rest}>{children}</a>
}
