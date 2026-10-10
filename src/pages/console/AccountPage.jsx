import { useRef, useState } from 'react'
import { clearMyHistory } from '../../api'
import { useAuth, MIN_PASSWORD_LENGTH } from '../../auth/AuthContext'
import ErrorBanner from '../../components/ErrorBanner'
import TurnstileWidget from '../../components/TurnstileWidget'
import { useToast } from '../../components/Toaster'
import { Pill } from '../../components/ui'
import { ApiError } from '../../lib/apiError'
import { config } from '../../lib/config'
import { fmtDateTime } from '../../lib/format'

const STATUS_PILL = {
  approved: { tone: 'good', label: 'Approved' },
  pending: { tone: 'warn', label: 'Waiting' },
  rejected: { tone: 'bad', label: 'Declined' },
}

/** Who you are, and a way to change your password. */
export default function AccountPage() {
  const { me, isAdmin, changePassword } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const captchaOn = Boolean(config.turnstileSiteKey)      // checking the current password is a sign in, so it needs the same token
  const [captchaToken, setCaptchaToken] = useState(null)
  const captcha = useRef(null)

  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState(null)

  async function clearHistory() {
    if (clearing) return
    setClearing(true)
    setClearError(null)
    try {
      const { deleted, kept_monitored: kept } = await clearMyHistory()
      setConfirmClear(false)
      toast.success('Search history cleared', {
        message: `${deleted} ${deleted === 1 ? 'screening' : 'screenings'} deleted.`
          + (kept ? ` ${kept} under continuous monitoring ${kept === 1 ? 'was' : 'were'} kept. Stop monitoring first to delete ${kept === 1 ? 'it' : 'them'}.` : ''),
      })
    } catch (err) {
      setClearError(err)
    } finally {
      setClearing(false)
    }
  }

  const status = STATUS_PILL[me.status] || { tone: 'warn', label: me.status }

  function problem(message, hint) {
    setError(new ApiError({ code: 'SIGN_IN_FAILED', message, hint }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setDone(false)
    if (!current) return problem('Enter your current password.')
    if (!password) return problem('Enter a new password.')
    if (password.length < MIN_PASSWORD_LENGTH) {
      return problem(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`,
        'A few unrelated words make a strong, easy to remember password.')
    }
    if (password !== confirm) return problem('The two passwords do not match.')
    if (password === current) return problem('The new password must be different from your current one.')
    if (captchaOn && !captchaToken) {
      return problem('Complete the security check first.', 'Wait for the check above the button to finish.')
    }
    setBusy(true)
    try {
      await changePassword(current, password, captchaToken)
      setCurrent('')
      setPassword('')
      setConfirm('')
      setDone(true)
      toast.success('Password changed', { message: 'Use the new password the next time you sign in.' })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
      if (captchaOn) captcha.current?.reset()      // a token works once: ask for a fresh one after every attempt
    }
  }

  return (
    <div className="workspace workspace-account">
      <section className="sheet" aria-labelledby="account-heading">
        <div className="folder-tab">Account</div>
        <h1 id="account-heading">Your account</h1>

        <div className="account-id">
          <span className="avatar avatar-large" aria-hidden="true">{(me.email || '?').charAt(0).toUpperCase()}</span>
          <div className="account-id-text">
            <p className="account-email">{me.email}</p>
            <p className="account-pills">
              <Pill tone={isAdmin ? 'good' : 'warn'}>{isAdmin ? 'Administrator' : 'User'}</Pill>{' '}
              <Pill tone={status.tone}>{status.label}</Pill>
            </p>
          </div>
        </div>

        <dl className="facts account-facts">
          <div className="fact"><dt>Email</dt><dd>{me.email}</dd></div>
          <div className="fact"><dt>Role</dt><dd>{isAdmin ? 'Administrator' : 'User'}</dd></div>
          {me.created_at && <div className="fact"><dt>Member since</dt><dd>{fmtDateTime(me.created_at)}</dd></div>}
        </dl>
      </section>

      <section className="sheet" aria-labelledby="password-heading">
        <div className="folder-tab">Security</div>
        <h1 id="password-heading">Change password</h1>
        <p className="lead">
          Enter your current password, then choose a new one of at least {MIN_PASSWORD_LENGTH} characters. You stay signed in on this device.
        </p>

        <form onSubmit={submit} className="form" noValidate>
          <label className="field" htmlFor="current-password">
            <span className="field-label">Current password</span>
            <input id="current-password" type={show ? 'text' : 'password'} value={current} autoComplete="current-password"
              onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field" htmlFor="new-password">
            <span className="field-label">New password</span>
            <input id="new-password" type={show ? 'text' : 'password'} value={password} autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)} />
            <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</span>
          </label>
          <label className="field" htmlFor="confirm-password">
            <span className="field-label">Repeat the new password</span>
            <input id="confirm-password" type={show ? 'text' : 'password'} value={confirm} autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <label className="check-line">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
          </label>
          {captchaOn && <TurnstileWidget ref={captcha} siteKey={config.turnstileSiteKey} onToken={setCaptchaToken} />}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving...' : 'Change password'}
            </button>
          </div>
        </form>

        {done && <p className="account-done" role="status">Your password was changed.</p>}
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </section>

      <section className="sheet" aria-labelledby="privacy-heading">
        <div className="folder-tab">Privacy</div>
        <h1 id="privacy-heading">Search history</h1>
        <p className="lead">
          Delete the screenings you have run. This removes them, with their results and evidence reports, from your
          History tab. Screenings under continuous monitoring are kept so the monitoring does not stop silently.
          Other people's screenings are not affected, and the deletion is recorded in the audit log.
        </p>
        {!confirmClear ? (
          <div className="form-actions">
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmClear(true)}>Clear search history</button>
          </div>
        ) : (
          <div role="alertdialog" aria-labelledby="clear-confirm-text" className="form-actions">
            <p id="clear-confirm-text">This cannot be undone. Delete your screening history?</p>
            <button type="button" className="btn btn-primary" onClick={clearHistory} disabled={clearing}>
              {clearing ? 'Deleting...' : 'Yes, delete it'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmClear(false)} disabled={clearing}>Cancel</button>
          </div>
        )}
        <ErrorBanner error={clearError} onDismiss={() => setClearError(null)} />
      </section>
    </div>
  )
}
