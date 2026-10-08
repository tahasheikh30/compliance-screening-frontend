import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { config, configProblems } from './lib/config'
import { ROUTES, navigate, usePath, isLegalPath, isInfoPath } from './lib/nav'
import Connecting from './pages/Connecting'
import SetupProblem from './pages/SetupProblem'
import Splash from './pages/Splash'
import GlobalLoader from './components/GlobalLoader'
import { ToastProvider } from './components/Toaster'

// Each screen is fetched only when it is shown. Someone who is already signed in never downloads the landing
// page, the information pages or their styles, and a visitor never downloads the console.
const loadConsole = () => import('./pages/Console')
const loadLanding = () => import('./pages/LandingPage')
const loadLogin = () => import('./pages/LoginScreen')
const Console = lazy(loadConsole)
const LandingPage = lazy(loadLanding)
const LoginScreen = lazy(loadLogin)
const LegalPage = lazy(() => import('./pages/LegalPage'))
const InfoPage = lazy(() => import('./pages/InfoPage'))
const WaitingScreen = lazy(() => import('./pages/WaitingScreen'))
const Analytics = lazy(() => import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })))

// Start fetching the screen this address needs right now, in parallel with the sign in check, instead of
// after it: the first paint no longer waits for a second round trip.
if (typeof window !== 'undefined') {
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/'
  if (path === ROUTES.landing) loadLanding().catch(() => {})
  else if (path === ROUTES.signIn || path === ROUTES.requestAccess) loadLogin().catch(() => {})
}

// Analytics is not needed to use the app, so it loads after the first screen and never delays it.
function DeferredAnalytics() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = typeof requestIdleCallback === 'function' ? requestIdleCallback(() => setReady(true), { timeout: 3000 }) : setTimeout(() => setReady(true), 1500)
    return () => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id))
  }, [])
  return ready ? <Suspense fallback={null}><Analytics /></Suspense> : null
}

/**
 * Public screens live at their own address: the landing page at /, sign in at /sign-in and the request
 * for an account at /request-access. The legal pages (/privacy, /terms, /cookies, /accessibility) and the information pages
 * (/how-it-works, /security, /about) can be read by anyone, signed in or not. Once signed in there is one screen (the console), always at /.
 */
function Router() {
  const { phase, me, notice } = useAuth()
  const path = usePath()
  const previous = useRef(phase)
  const signedOut = phase === 'signed-out'
  const knownPath = Object.values(ROUTES).includes(path)
  // Signed out with something to say (idle, session ended) or having just signed out: show the sign in
  // screen, not the landing page. Decided here, while rendering, so the landing page never flashes first.
  const justLeft = previous.current === 'checking' || previous.current === 'ready'
  const redirectToSignIn = signedOut && path === ROUTES.landing && (justLeft || Boolean(notice))

  useEffect(() => {
    previous.current = phase
    if (!signedOut) {
      // the console has no address of its own: leave /sign-in behind once signed in
      if (phase !== 'loading' && path !== ROUTES.landing && !isLegalPath(path) && !isInfoPath(path)) navigate(ROUTES.landing, { replace: true })
    } else if (!knownPath) {
      navigate(ROUTES.landing, { replace: true })
    } else if (redirectToSignIn) {
      navigate(ROUTES.signIn, { replace: true })
    }
  }, [phase, signedOut, path, knownPath, redirectToSignIn])

  // The console is the next stop for anyone signing in: fetch it while they type their password or while the
  // server confirms who they are, so it opens the moment they are through.
  const onSignInScreen = signedOut && (path === ROUTES.signIn || path === ROUTES.requestAccess)
  useEffect(() => {
    if (onSignInScreen || phase === 'checking') loadConsole().catch(() => {})
    if (signedOut && path === ROUTES.landing) loadLogin().catch(() => {})
  }, [onSignInScreen, phase, signedOut, path])

  if (phase === 'loading') return <Splash>Loading...</Splash>
  if (isLegalPath(path)) return <LegalPage path={path} />
  if (isInfoPath(path)) return <InfoPage path={path} />
  if (signedOut) {
    const asSignup = path === ROUTES.requestAccess
    if (asSignup || path === ROUTES.signIn || redirectToSignIn) {
      return (
        <LoginScreen
          mode={asSignup ? 'signup' : 'signin'}
          onSwitchMode={(next) => navigate(next === 'signup' ? ROUTES.requestAccess : ROUTES.signIn, { replace: true })}
        />
      )
    }
    return <LandingPage />
  }
  if (phase === 'checking' || !me) return <Connecting />
  if (me.status !== 'approved') return <WaitingScreen />
  return (
    <Suspense fallback={<Splash>Loading...</Splash>}>
      <Console />
    </Suspense>
  )
}

export default function App() {
  const problems = useMemo(() => configProblems(config), [])
  if (problems.length > 0) return <SetupProblem problems={problems} />
  return (
    <AuthProvider>
      <ToastProvider>
        <GlobalLoader />
        <Suspense fallback={<Splash>Loading...</Splash>}>
          <Router />
        </Suspense>
        <DeferredAnalytics />
      </ToastProvider>
    </AuthProvider>
  )
}
