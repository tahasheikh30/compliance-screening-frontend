import { useRef, useState } from 'react'
import { clearMyHistory, deleteMyAccount, disableMyAccount, exportHistory } from '../../api'
import { useAuth, MIN_PASSWORD_LENGTH } from '../../auth/AuthContext'
import ConfirmDialog from '../ConfirmDialog'
import ErrorBanner from '../ErrorBanner'
import TurnstileWidget from '../TurnstileWidget'
import { useToast } from '../Toaster'
import { Pill } from '../ui'
import { SettingGroup, SettingRow } from './controls'
import { ApiError } from '../../lib/apiError'
import { config } from '../../lib/config'
import { fmtDateTime } from '../../lib/format'

const STATUS_PILL = {
  approved: { tone: 'good', label: 'Approved' },
  pending: { tone: 'warn', label: 'Waiting' },
  rejected: { tone: 'bad', label: 'Declined' },
  disabled: { tone: 'bad', label: 'Disabled' },
}

/**
 * Settings, Account: who you are, your password, your search history, and switching off or deleting the account.
 * Disabling keeps everything and can be undone by an administrator. Deleting removes the sign in for good; the
 * screenings stay in the compliance record with nobody's name on them.
 */
export default function AccountSection() {
  const { me, isAdmin, changePassword, leaveWithNotice } = useAuth()
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
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  const [dialog, setDialog] = useState(null)             // 'disable' | 'delete' | null
  const [typedEmail, setTypedEmail] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)

  async function clearHistory() {
    if (clearing) return
    setClearing(true)
    setClearError(null)
    try {
      const { deleted, kept_monitored: kept } = await clearMyHistory()
      setConfirmClear(false)
      toast.success('Search history cleared', {
        category: 'account',
        message: `${deleted} ${deleted === 1 ? 'screening' : 'screenings'} deleted.`
          + (kept ? ` ${kept} under continuous monitoring ${kept === 1 ? 'was' : 'were'} kept. Stop monitoring first to delete ${kept === 1 ? 'it' : 'them'}.` : ''),
      })
    } catch (err) {
      setClearError(err)
    } finally {
      setClearing(false)
    }
  }

  async function download() {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      await exportHistory()
    } catch (err) {
      setExportError(err)
    } finally {
      setExporting(false)
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
      toast.success('Password changed', { category: 'account', message: 'Use the new password the next time you sign in.' })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
      if (captchaOn) captcha.current?.reset()      // a token works once: ask for a fresh one after every attempt
    }
  }

  function closeDialog() {
    if (leaving) return
    setDialog(null)
    setTypedEmail('')
    setLeaveError(null)
  }

  async function leave() {
    if (leaving || !dialog) return
    setLeaving(true)
    setLeaveError(null)
    try {
      if (dialog === 'disable') {
        await disableMyAccount()
        leaveWithNotice?.('Your account was disabled. An administrator can switch it back on.')
      } else {
        await deleteMyAccount(typedEmail.trim())
        leaveWithNotice?.('Your account was deleted.')
      }
    } catch (err) {
      setLeaveError(err)
      setLeaving(false)
    }
  }

  const emailMatches = typedEmail.trim().toLowerCase() === (me.email || '').toLowerCase()

  return (
    <div className="settings-section">
      <SettingGroup title="Your account">
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
      </SettingGroup>

      <SettingGroup
        title="Change password"
        hint={`Enter your current password, then choose a new one of at least ${MIN_PASSWORD_LENGTH} characters. You stay signed in on this device.`}
      >
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
      </SettingGroup>

      <SettingGroup
        title="Your data"
        hint="Your screenings are kept so you can find them again. Other people's screenings are never affected, and deletions are recorded in the audit log."
      >
        <SettingRow
          title="Download my history"
          description="A CSV file of the screenings you have run."
        >
          <button type="button" className="btn btn-quiet" onClick={download} disabled={exporting}>
            {exporting ? 'Preparing...' : 'Download CSV'}
          </button>
        </SettingRow>
        <ErrorBanner error={exportError} onDismiss={() => setExportError(null)} />
        <h4 className="setting-subtitle" id="history-heading">Search history</h4>
        <p className="setting-desc">
          Delete the screenings you have run. This removes them, with their results and evidence reports, from your
          History tab. Screenings under continuous monitoring are kept so the monitoring does not stop silently.
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
      </SettingGroup>

      <SettingGroup
        title="Disable or delete your account"
        danger
        hint="Both sign you out at once."
      >
        <SettingRow
          title="Disable my account"
          description="Locks the account. Everything is kept, and only an administrator can switch it back on."
        >
          <button type="button" className="btn btn-quiet" onClick={() => setDialog('disable')}>Disable account</button>
        </SettingRow>
        <SettingRow
          title="Delete my account"
          description="Removes your sign in for good. Your past screenings stay in the compliance record with no name on them, visible to administrators only."
        >
          <button type="button" className="btn btn-danger" onClick={() => setDialog('delete')}>Delete account</button>
        </SettingRow>
      </SettingGroup>

      {dialog === 'disable' && (
        <ConfirmDialog
          danger
          title="Disable your account?"
          body="You will be signed out now and cannot sign in again until an administrator switches your account back on. Your screenings are kept."
          confirmLabel={leaving ? 'Disabling...' : 'Disable my account'}
          disabled={leaving}
          onConfirm={leave}
          onCancel={closeDialog}
        >
          <ErrorBanner error={leaveError} onDismiss={() => setLeaveError(null)} />
        </ConfirmDialog>
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          danger
          title="Delete your account?"
          body="This cannot be undone. Your sign in and your settings are removed. Your past screenings stay in the compliance record without your name on them."
          confirmLabel={leaving ? 'Deleting...' : 'Delete my account'}
          disabled={leaving || !emailMatches}
          onConfirm={leave}
          onCancel={closeDialog}
        >
          <label className="field" htmlFor="delete-confirm-email">
            <span className="field-label">Type your email address ({me.email}) to confirm</span>
            <input id="delete-confirm-email" type="email" value={typedEmail} autoComplete="off" spellCheck={false}
              onChange={(e) => setTypedEmail(e.target.value)} />
          </label>
          <ErrorBanner error={leaveError} onDismiss={() => setLeaveError(null)} />
        </ConfirmDialog>
      )}
    </div>
  )
}
