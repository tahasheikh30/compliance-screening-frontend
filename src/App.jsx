import { useState, useEffect } from 'react'
import { verifyApiKey, getStoredKey, storeKey, clearKey, isValidKeyFormat, takeLastAuthError, SIGNED_OUT_EVENT } from './api'
import { ApiError } from './lib/apiError'
import ErrorBanner from './components/ErrorBanner'
import ErrorBoundary from './components/ErrorBoundary'
import ScreeningTab from './components/ScreeningTab'
import HistoryTab from './components/HistoryTab'
import ListsTab from './components/ListsTab'
import DataNoticeDialog from './components/DataNoticeDialog'
import { MagnifyingGlassIcon } from './components/ui'

function AccessGate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [waking, setWaking] = useState(false)
  const [error, setError] = useState(null)

  // If we were just sent back here by a rejected request, explain why instead of
  // silently reappearing (see api.js handleAuthFailure).
  useEffect(() => {
    const last = takeLastAuthError()
    if (last) setError(last)
  }, [])

  async function handleSubmit(e) {
    e?.preventDefault?.()
    const key = value.trim()
    if (!key) return
    if (!isValidKeyFormat(key)) {
      setError(new ApiError({
        code: 'AUTH_INVALID_KEY',
        message: 'That does not look like an access key.',
        hint: 'It contains spaces or unusual characters, often from copying it with a line break or a smart quote. Paste it again.',
      }))
      return
    }
    setChecking(true)
    setWaking(false)
    setError(null)
    try {
      await verifyApiKey(key, { onWaking: () => setWaking(true) })
      storeKey(key)
      onUnlock()
    } catch (err) {
      setError(err)
    } finally {
      setChecking(false)
      setWaking(false)
    }
  }

  return (
    <main className="gate">
      <section className="sheet gate-sheet" aria-labelledby="gate-heading">
        <div className="folder-tab">Restricted</div>
        <h1 id="gate-heading"><MagnifyingGlassIcon size={22} /> Screening console</h1>
        <p className="lead">Enter the access key to open the console. Authorized personnel only.</p>
        <form onSubmit={handleSubmit} className="form">
          <label className="field" htmlFor="access-key-input">
            <span className="field-label">Access key</span>
            <input
              id="access-key-input"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={checking || !value.trim()}>
              {checking ? 'Checking...' : 'Unlock'}
            </button>
          </div>
        </form>
        {checking && (
          <p className="muted" role="status">
            {waking
              ? 'The server was asleep and is starting up. This can take up to a minute. Keep this page open.'
              : 'Connecting to the server...'}
          </p>
        )}
        <ErrorBanner error={error} onRetry={value.trim() ? handleSubmit : undefined} onDismiss={() => setError(null)} />
      </section>
    </main>
  )
}

const TABS = [
  { id: 'screen', label: 'Screening' },
  { id: 'history', label: 'History' },
  { id: 'lists', label: 'Lists' },
]

export default function App() {
  const [unlocked, setUnlocked] = useState(() => !!getStoredKey())
  const [tab, setTab] = useState('screen')
  const [showNotice, setShowNotice] = useState(false)

  // Any request the backend refuses because of the key (see api.js) sends us back to the gate.
  useEffect(() => {
    const onSignedOut = () => setUnlocked(false)
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

  if (!unlocked) return <AccessGate onUnlock={() => setUnlocked(true)} />

  function lock() {
    clearKey()
    setUnlocked(false)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><MagnifyingGlassIcon size={20} /></span>
          <span className="brand-text">
            <span className="brand-name">Case File</span>
            <span className="brand-sub">Applicant screening</span>
          </span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'tab-on' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <button type="button" className="btn btn-ghost" onClick={lock}>Lock</button>
      </header>

      <main className="main">
        <ErrorBoundary key={tab}>
          {tab === 'screen' && <ScreeningTab />}
          {tab === 'history' && <HistoryTab />}
          {tab === 'lists' && <ListsTab />}
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <span>Internal tool, IGI General Takaful, Compliance dept.</span>
        <button type="button" className="link-btn" onClick={() => setShowNotice(true)}>Data handling notice</button>
      </footer>

      {showNotice && <DataNoticeDialog onClose={() => setShowNotice(false)} />}
    </div>
  )
}
