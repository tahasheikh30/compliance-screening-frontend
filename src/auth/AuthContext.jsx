import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getMe, SESSION_ENDED_EVENT, ACCOUNT_CHANGED_EVENT } from '../api'
import { getSupabase } from '../lib/supabase'
import { friendlyAuthError } from '../lib/authErrors'
import { clearActivity, idleExpired, touch, watchActivity } from '../lib/idle'

const AuthContext = createContext(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

export const MIN_PASSWORD_LENGTH = 12
const TOKEN_REFUSED = new Set(['AUTH_REQUIRED', 'AUTH_INVALID_TOKEN', 'AUTH_TOKEN_EXPIRED'])
const PENDING_POLL_MS = 20000

/**
 * Who is using the app. Three layers, in order:
 *   1. Supabase Auth: is there a signed in session (email and password)?
 *   2. The backend: /api/me says whether this person is approved, and whether they are an admin.
 *   3. This component: idle sign out, and sending people to the right screen.
 *
 * phase: 'loading' (checking for a saved session) | 'signed-out' | 'checking' (signed in, asking the
 *        backend) | 'ready' (me is known: me.status says pending, approved or rejected)
 */
export function AuthProvider({ children }) {
  const [phase, setPhase] = useState('loading')
  const [me, setMe] = useState(null)
  const [meError, setMeError] = useState(null)
  const [notice, setNotice] = useState(null)
  const meRef = useRef(null)
  meRef.current = me

  const endSession = useCallback(async (message) => {
    try { await getSupabase().auth.signOut({ scope: 'local' }) } catch { /* the local session is dropped regardless */ }
    clearActivity()
    setMe(null)
    setMeError(null)
    setNotice(message || null)
    setPhase('signed-out')
  }, [])

  const loadMe = useCallback(async () => {
    try {
      const next = await getMe()
      setMe(next)
      setMeError(null)
      setPhase('ready')
    } catch (err) {
      // A refused sign in is handled by the SESSION_ENDED_EVENT listener below. Anything else (the server
      // asleep, a network drop, the app's own key being wrong) leaves the person signed in with the reason
      // and a retry, not on a login screen.
      if (!(err?.status === 401 && TOKEN_REFUSED.has(err.code))) {
        setMeError(err)
        setPhase((p) => (p === 'ready' ? p : 'checking'))
      }
    }
  }, [])

  // find a saved session on start, and follow sign in and sign out from then on
  useEffect(() => {
    const { auth } = getSupabase()
    let active = true
    ;(async () => {
      if (idleExpired()) {
        await endSession('You were signed out after 30 minutes of inactivity.')
        return
      }
      const { data } = await auth.getSession()
      if (!active) return
      if (data.session) {
        touch()
        setPhase('checking')
        loadMe()
      } else {
        setPhase('signed-out')
      }
    })()
    const { data: sub } = auth.onAuthStateChange((event, session) => {
      // Do not call Supabase from inside this callback (it can deadlock): defer.
      setTimeout(() => {
        if (!active) return
        if (event === 'SIGNED_OUT') {
          setMe(null)
          setPhase('signed-out')
        } else if (event === 'SIGNED_IN' && session && meRef.current?.id !== session.user.id) {
          setPhase('checking')
          loadMe()
        }
      }, 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [endSession, loadMe])

  // the backend refused this sign in (revoked, expired beyond repair), or the person's status changed
  useEffect(() => {
    const onEnded = () => endSession('Your session has ended. Please sign in again.')
    const onChanged = () => loadMe()
    window.addEventListener(SESSION_ENDED_EVENT, onEnded)
    window.addEventListener(ACCOUNT_CHANGED_EVENT, onChanged)
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, onEnded)
      window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChanged)
    }
  }, [endSession, loadMe])

  // idle sign out while signed in
  const signedIn = phase === 'checking' || phase === 'ready'
  useEffect(() => {
    if (!signedIn) return undefined
    return watchActivity(() => endSession('You were signed out after 30 minutes of inactivity.'))
  }, [signedIn, endSession])

  // a person waiting for approval: look again every so often, and when they come back to the tab
  const waiting = phase === 'ready' && me?.status === 'pending'
  useEffect(() => {
    if (!waiting) return undefined
    const timer = setInterval(loadMe, PENDING_POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') loadMe() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [waiting, loadMe])

  // captchaToken: the Turnstile token, when CAPTCHA protection is on (see TurnstileWidget). Supabase checks it.
  const signIn = useCallback(async (email, password, captchaToken) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    })
    if (error) throw friendlyAuthError(error)
    touch()
    setNotice(null)
  }, [])

  /** Resolves { confirmEmail }: true when Supabase wants the address confirmed before the first sign in. */
  const signUp = useCallback(async (email, password, captchaToken) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin, ...(captchaToken ? { captchaToken } : {}) },
    })
    if (error) throw friendlyAuthError(error)
    if (data.session) touch()
    setNotice(null)
    return { confirmEmail: !data.session }
  }, [])

  /** Sets a new password for the signed in person. Supabase may ask them to have signed in recently. */
  const changePassword = useCallback(async (password) => {
    const { error } = await getSupabase().auth.updateUser({ password })
    if (error) throw friendlyAuthError(error)
    touch()
  }, [])

  const signOut = useCallback(() => endSession(null), [endSession])
  const clearNotice = useCallback(() => setNotice(null), [])

  const value = useMemo(() => ({
    phase, me, meError, notice, signIn, signUp, signOut, changePassword, refresh: loadMe, clearNotice,
    isAdmin: me?.role === 'admin' && me?.status === 'approved',
  }), [phase, me, meError, notice, signIn, signUp, signOut, changePassword, loadMe, clearNotice])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
