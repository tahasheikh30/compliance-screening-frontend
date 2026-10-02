import { useState, useEffect } from 'react'
import { verifyApiKey } from './api'
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
  const [error, setError] = useState(null)

  // If we were just bounced here by a 401 on some other request, explain why
  // instead of silently reappearing (see api.js dropKeyOn401).
  useEffect(() => {
    const raw = sessionStorage.getItem('screening_last_auth_error')
    if (raw) {
      sessionStorage.removeItem('screening_last_auth_error')
      try {
        const { code, message } = JSON.parse(raw)
        setError(new ApiError({ status: 401, code, message }))
      } catch { /* ignore malformed */ }
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim()) return
    setChecking(true)
    setError(null)
    try {
      const ok = await verifyApiKey(value.trim())
      if (ok) {
        sessionStorage.setItem('screening_api_key', value.trim())
        onUnlock()
      }
    } catch (err) {
      setError(err)
    } finally {
      setChecking(false)
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
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem('screening_api_key'))
  const [tab, setTab] = useState('screen')
  const [showNotice, setShowNotice] = useState(false)

  if (!unlocked) return <AccessGate onUnlock={() => setUnlocked(true)} />

  function lock() {
    sessionStorage.removeItem('screening_api_key')
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
