import { useEffect, useState } from 'react'
import { useAuth, MIN_PASSWORD_LENGTH } from '../auth/AuthContext'
import { wakeBackend } from '../api'
import ErrorBanner from './ErrorBanner'
import { ApiError } from '../lib/apiError'
import { MagnifyingGlassIcon } from './ui'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginScreen() {
  const { signIn, signUp, notice, clearNotice } = useAuth()
  const [mode, setMode] = useState('signin')            // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(null)                 // { confirmEmail } after a request for access

  // The backend is on a plan that sleeps when idle. Wake it while the person types, so signing in is quick.
  useEffect(() => { wakeBackend().catch(() => {}) }, [])

  function switchMode(next) {
    setMode(next)
    setError(null)
    setSent(null)
    setPassword('')
    setConfirm('')
  }

  function problem(message, hint) {
    setError(new ApiError({ code: 'SIGN_IN_FAILED', message, hint }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setError(null)
    clearNotice()
    const address = email.trim()
    if (!EMAIL_RE.test(address)) return problem('Enter your email address.')
    if (!password) return problem('Enter your password.')
    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        return problem(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`,
          'A few unrelated words make a strong, easy to remember password.')
      }
      if (password !== confirm) return problem('The two passwords do not match.')
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        setSent(await signUp(address, password))
        setPassword('')
        setConfirm('')
      } else {
        await signIn(address, password)      // the app moves on by itself once the session starts
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const signup = mode === 'signup'

  return (
    <main className="gate">
      <section className="sheet gate-sheet" aria-labelledby="gate-heading">
        <div className="folder-tab">Restricted</div>
        <h1 id="gate-heading"><MagnifyingGlassIcon size={22} /> Screening console</h1>
        <p className="lead">
          {signup ? 'Request an account. An administrator approves it before you can use the console.'
            : 'Sign in with your account. Authorized personnel only.'}
        </p>

        {notice && <p className="notice-line" role="status">{notice}</p>}

        {sent ? (
          <div className="sent-panel" role="status">
            <h2>Request received</h2>
            <p>
              {sent.confirmEmail
                ? 'Check your email and open the confirmation link. Then sign in: your account will wait for an administrator to approve it.'
                : 'Your account is waiting for an administrator to approve it. You can sign in now to see where it stands.'}
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => switchMode('signin')}>Go to sign in</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="form" noValidate>
            <label className="field" htmlFor="login-email">
              <span className="field-label">Work email</span>
              <input id="login-email" type="email" inputMode="email" value={email} autoFocus
                onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck="false" />
            </label>
            <label className="field" htmlFor="login-password">
              <span className="field-label">Password</span>
              <input id="login-password" type={show ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} />
              {signup && <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</span>}
            </label>
            {signup && (
              <label className="field" htmlFor="login-confirm">
                <span className="field-label">Repeat the password</span>
                <input id="login-confirm" type={show ? 'text' : 'password'} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </label>
            )}
            <label className="check-line">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
            </label>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? (signup ? 'Sending...' : 'Signing in...') : (signup ? 'Request account' : 'Sign in')}
              </button>
              <button type="button" className="link-btn" onClick={() => switchMode(signup ? 'signin' : 'signup')}>
                {signup ? 'I already have an account' : 'Request an account'}
              </button>
            </div>
          </form>
        )}

        {busy && <p className="muted" role="status">{signup ? 'Sending your request...' : 'Signing you in...'}</p>}
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </section>
    </main>
  )
}
