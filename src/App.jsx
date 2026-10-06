import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { listUsers } from './api'
import { config, configProblems } from './lib/config'
import ErrorBanner from './components/ErrorBanner'
import ErrorBoundary from './components/ErrorBoundary'
import LoginScreen from './components/LoginScreen'
import WaitingScreen from './components/WaitingScreen'
import ScreeningTab from './components/ScreeningTab'
import HistoryTab from './components/HistoryTab'
import ListsTab from './components/ListsTab'
import UsersTab from './components/UsersTab'
import DataNoticeDialog from './components/DataNoticeDialog'
import { MagnifyingGlassIcon } from './components/ui'

/** The app was built without what it needs to reach the backend or Supabase. Say exactly what. */
function SetupProblem({ problems }) {
  return (
    <main className="gate">
      <section className="sheet gate-sheet" aria-labelledby="setup-heading">
        <div className="folder-tab">Setup</div>
        <h1 id="setup-heading"><MagnifyingGlassIcon size={22} /> This app is not set up yet</h1>
        <p className="lead">An administrator needs to fix the following in the frontend's environment settings, then redeploy it.</p>
        <ul className="setup-list">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>
    </main>
  )
}

function Splash({ children }) {
  return (
    <main className="gate">
      <section className="sheet gate-sheet">
        <p className="muted" role="status">{children}</p>
      </section>
    </main>
  )
}

/** Signed in, and the backend has not answered yet (often because it was asleep). */
function Connecting() {
  const { meError, refresh, signOut } = useAuth()
  return (
    <main className="gate">
      <section className="sheet gate-sheet" aria-labelledby="connect-heading">
        <h1 id="connect-heading"><MagnifyingGlassIcon size={22} /> Connecting to the server</h1>
        <p className="lead" role="status">
          {meError ? 'The server did not answer.' : 'Signing you in. If the server was asleep this can take up to a minute.'}
        </p>
        <ErrorBanner error={meError} onRetry={refresh} />
        <div className="form-actions"><button type="button" className="btn btn-quiet" onClick={signOut}>Sign out</button></div>
      </section>
    </main>
  )
}

const BASE_TABS = [
  { id: 'screen', label: 'Screening' },
  { id: 'history', label: 'History' },
  { id: 'lists', label: 'Lists' },
]

function Console() {
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
    const timer = setInterval(look, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [isAdmin])

  const tabs = useMemo(() => (isAdmin ? [...BASE_TABS, { id: 'people', label: 'People' }] : BASE_TABS), [isAdmin])
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
          {tab === 'screen' && <ScreeningTab />}
          {tab === 'history' && <HistoryTab isAdmin={isAdmin} />}
          {tab === 'lists' && <ListsTab isAdmin={isAdmin} />}
          {tab === 'people' && isAdmin && <UsersTab selfId={me.id} onPendingCount={onPendingCount} />}
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

function Router() {
  const { phase, me } = useAuth()
  if (phase === 'loading') return <Splash>Loading...</Splash>
  if (phase === 'signed-out') return <LoginScreen />
  if (phase === 'checking' || !me) return <Connecting />
  if (me.status !== 'approved') return <WaitingScreen />
  return <Console />
}

export default function App() {
  const problems = useMemo(() => configProblems(config), [])
  if (problems.length > 0) return <SetupProblem problems={problems} />
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}
