import { Suspense, lazy, useEffect, useMemo, useRef } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { config, configProblems } from './lib/config'
import { ROUTES, navigate, usePath } from './lib/nav'
import LandingPage from './pages/LandingPage'
import LoginScreen from './pages/LoginScreen'
import WaitingScreen from './pages/WaitingScreen'
import SetupProblem from './pages/SetupProblem'
import Connecting from './pages/Connecting'
import Splash from './pages/Splash'
import GlobalLoader from './components/GlobalLoader'
import { ToastProvider } from './components/Toaster'

// Only people who are signed in and approved need the console, so it is fetched separately.
const Console = lazy(() => import('./pages/Console'))

/**
 * Public screens live at their own address: the landing page at /, sign in at /sign-in and the request
 * for an account at /request-access. Once signed in there is one screen (the console), always at /.
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
      if (phase !== 'loading' && path !== ROUTES.landing) navigate(ROUTES.landing, { replace: true })
    } else if (!knownPath) {
      navigate(ROUTES.landing, { replace: true })
    } else if (redirectToSignIn) {
      navigate(ROUTES.signIn, { replace: true })
    }
  }, [phase, signedOut, path, knownPath, redirectToSignIn])

  if (phase === 'loading') return <Splash>Loading...</Splash>
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
        <Router />
      </ToastProvider>
    </AuthProvider>
  )
}
