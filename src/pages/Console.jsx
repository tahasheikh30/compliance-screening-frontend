import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listUsers } from '../api'
import ErrorBoundary from '../components/ErrorBoundary'
import DataNoticeDialog from '../components/DataNoticeDialog'
import { MagnifyingGlassIcon } from '../components/ui'
import ScreeningTab from './console/ScreeningTab'

// The first tab is needed immediately; the rest are fetched the first time they are opened.
const HistoryTab = lazy(() => import('./console/HistoryTab'))
const ListsTab = lazy(() => import('./console/ListsTab'))
const UsersTab = lazy(() => import('./console/UsersTab'))

const BASE_TABS = [
  { id: 'screen', label: 'Screening' },
  { id: 'history', label: 'History' },
  { id: 'lists', label: 'Lists' },
]
const PEOPLE_TAB = { id: 'people', label: 'People' }
const PENDING_POLL_MS = 60000

export default function Console() {
  const { me, isAdmin, signOut } = useAuth()
  const [tab, setTab] = useState('screen')
  const [showNotice, setShowNotice] = useState(false)
  const [pending, setPending] = useState(0)

  // administrators see how many people are waiting, whichever tab they are on
  useEffect(() => {
    if (!isAdmin) return undefined
    let active = true
    const look = async () => {
      try {
        const waiting = await listUsers('pending')
        if (active) setPending(waiting.length)
      } catch { /* the People tab shows the error if it persists */ }
    }
    look()
    const timer = setInterval(look, PENDING_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [isAdmin])

  const tabs = useMemo(() => (isAdmin ? [...BASE_TABS, PEOPLE_TAB] : BASE_TABS), [isAdmin])
  const onPendingCount = useCallback((n) => setPending(n), [])

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
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'tab-on' : ''}`}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
              {t.id === 'people' && pending > 0 && <span className="tab-badge" aria-label={`${pending} waiting`}>{pending}</span>}
            </button>
          ))}
        </nav>
        <div className="whoami">
          <span className="whoami-email" title={me.email}>{me.email}</span>
          <span className="whoami-role">{isAdmin ? 'Administrator' : 'User'}</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={signOut}>Sign out</button>
      </header>

      <main className="main">
        <ErrorBoundary key={tab}>
          <Suspense fallback={<p className="muted" role="status">Loading...</p>}>
            {tab === 'screen' && <ScreeningTab />}
            {tab === 'history' && <HistoryTab isAdmin={isAdmin} />}
            {tab === 'lists' && <ListsTab isAdmin={isAdmin} />}
            {tab === 'people' && isAdmin && <UsersTab selfId={me.id} onPendingCount={onPendingCount} />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <span>Internal tool, IGI Holdings, Compliance dept.</span>
        <button type="button" className="link-btn" onClick={() => setShowNotice(true)}>Data handling notice</button>
      </footer>

      {showNotice && <DataNoticeDialog onClose={() => setShowNotice(false)} />}
    </div>
  )
}
