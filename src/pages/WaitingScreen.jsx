import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import ErrorBanner from '../components/ErrorBanner'
import { MagnifyingGlassIcon } from '../components/ui'
import SiteFooter from '../components/SiteFooter'

/** Shown to someone who is signed in but not approved: waiting for an administrator, or declined. */
export default function WaitingScreen() {
  const { me, refresh, signOut, meError } = useAuth()
  const [checking, setChecking] = useState(false)
  const rejected = me?.status === 'rejected'
  const disabled = me?.status === 'disabled'
  const closed = rejected || disabled        // nothing to wait for: an administrator has to act

  async function check() {
    setChecking(true)
    try { await refresh() } finally { setChecking(false) }
  }

  return (
    <div className="gate-page">
    <main className="gate">
      <section className="sheet gate-sheet" aria-labelledby="wait-heading">
        <div className="folder-tab">{disabled ? 'Disabled' : rejected ? 'Declined' : 'Pending'}</div>
        <h1 id="wait-heading"><MagnifyingGlassIcon size={22} /> {disabled ? 'Account disabled' : rejected ? 'Request declined' : 'Waiting for approval'}</h1>
        <p className="lead">
          {disabled
            ? 'An administrator has disabled this account. Contact the compliance team to have it switched back on.'
            : rejected
            ? 'An administrator declined this account. If you think that is a mistake, contact the compliance team.'
            : 'Your account is created. An administrator needs to approve it before you can use the console. This page updates by itself.'}
        </p>
        <p className="muted">Signed in as <strong>{me?.email}</strong></p>
        <div className="form-actions">
          {!closed && (
            <button type="button" className="btn btn-primary" onClick={check} disabled={checking}>
              {checking ? 'Checking...' : 'Check again'}
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={signOut}>Sign out</button>
        </div>
        <ErrorBanner error={meError} onRetry={check} />
      </section>
    </main>
    <SiteFooter />
    </div>
  )
}
