import { useState } from 'react'
import { useAuth, MIN_PASSWORD_LENGTH } from '../../auth/AuthContext'
import ErrorBanner from '../../components/ErrorBanner'
import { useToast } from '../../components/Toaster'
import { Pill } from '../../components/ui'
import { ApiError } from '../../lib/apiError'
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
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const status = STATUS_PILL[me.status] || { tone: 'warn', label: me.status }

  function problem(message, hint) {
    setError(new ApiError({ code: 'SIGN_IN_FAILED', message, hint }))
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setDone(false)
    if (!password) return problem('Enter a new password.')
    if (password.length < MIN_PASSWORD_LENGTH) {
      return problem(`Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`,
        'A few unrelated words make a strong, easy to remember password.')
    }
    if (password !== confirm) return problem('The two passwords do not match.')
    setBusy(true)
    try {
      await changePassword(password)
      setPassword('')
      setConfirm('')
      setDone(true)
      toast.success('Password changed', { message: 'Use the new password the next time you sign in.' })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
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
          Choose a new password of at least {MIN_PASSWORD_LENGTH} characters. You stay signed in on this device.
        </p>

        <form onSubmit={submit} className="form" noValidate>
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
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving...' : 'Change password'}
            </button>
          </div>
        </form>

        {done && <p className="account-done" role="status">Your password was changed.</p>}
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </section>
    </div>
  )
}
