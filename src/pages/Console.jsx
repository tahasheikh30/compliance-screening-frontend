import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listUsers } from '../api'
import ErrorBoundary from '../components/ErrorBoundary'
import SiteFooter from '../components/SiteFooter'
import { MagnifyingGlassIcon } from '../components/ui'
import ProfileMenu from '../components/ProfileMenu'
import { useNotifications, useToast } from '../components/Toaster'
import { useActivity } from '../lib/activity'
import ScreeningTab from './console/ScreeningTab'
import AccountPage from './console/AccountPage'
import NotificationsPage from './console/NotificationsPage'

// The first tab is needed immediately; the rest are fetched the first time they are opened.
const HistoryTab = lazy(() => import('./console/HistoryTab'))
const ListsTab = lazy(() => import('./console/ListsTab'))
const UsersTab = lazy(() => import('./console/UsersTab'))

// Shown while a tab's code is being fetched; the global loader does the visible work.
function TabLoading() {
  useActivity()
  return null
}

const BASE_TABS = [
  { id: 'screen', label: 'Screening' },
  { id: 'history', label: 'History' },
  { id: 'lists', label: 'Lists' },
]
const PEOPLE_TAB = { id: 'people', label: 'People' }

// Small line icons for the tabs. Decorative: the label carries the meaning.
function TabIcon({ id }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }
  if (id === 'screen') return <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></svg>
  if (id === 'history') return <svg {...common}><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
  if (id === 'lists') return <svg {...common}><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>
  return <svg {...common}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.4c2.2.7 3.5 2.6 3.5 5.6" /></svg>
}
const PENDING_POLL_MS = 60000

export default function Console() {
  const { me, isAdmin, signOut } = useAuth()
  const [tab, setTab] = useState('screen')
  const [page, setPage] = useState(null)            // 'account' | 'notifications' | null (a tab is showing)
  const toast = useToast()
  const { unread } = useNotifications()
  const lastPending = useRef(null)
  const [pending, setPending] = useState(0)

  // administrators see how many people are waiting, whichever tab they are on
  useEffect(() => {
    if (!isAdmin) return undefined
    let active = true
    const look = async () => {
      try {
        const waiting = await listUsers('pending', { background: true })
        if (!active) return
        setPending(waiting.length)
        // tell the administrator when people are waiting, on the first look and whenever there are more
        if (waiting.length > 0 && (lastPending.current === null || waiting.length > lastPending.current)) {
          toast.info(
            waiting.length === 1 ? '1 account is waiting for approval' : `${waiting.length} accounts are waiting for approval`,
            { message: 'Review them on the People tab.', to: 'people' },
          )
        }
        lastPending.current = waiting.length
      } catch { /* the People tab shows the error if it persists */ }
    }
    look()
    const timer = setInterval(look, PENDING_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [isAdmin, toast])

  const tabs = useMemo(() => (isAdmin ? [...BASE_TABS, PEOPLE_TAB] : BASE_TABS), [isAdmin])
  const onPendingCount = useCallback((n) => { setPending(n); lastPending.current = n }, [])
  const goTab = useCallback((id) => { setTab(id); setPage(null) }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><MagnifyingGlassIcon size={20} /></span>
          <span className="brand-text">
            <span className="brand-name">Sentinel by Packages</span>
            <span className="brand-sub">Applicant screening</span>
          </span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${!page && tab === t.id ? 'tab-on' : ''}`}
              onClick={() => goTab(t.id)}
              aria-current={!page && tab === t.id ? 'page' : undefined}
            >
              <TabIcon id={t.id} />
              {t.label}
              {t.id === 'people' && pending > 0 && <span className="tab-badge" aria-label={`${pending} waiting`}>{pending}</span>}
            </button>
          ))}
        </nav>
        <ProfileMenu
          email={me.email}
          isAdmin={isAdmin}
          unread={unread}
          onAccount={() => setPage('account')}
          onNotifications={() => setPage('notifications')}
          onSignOut={signOut}
        />
      </header>

      <main className="main">
        <ErrorBoundary key={page || tab}>
          <Suspense fallback={<TabLoading />}>
            {page === 'account' && <AccountPage />}
            {page === 'notifications' && <NotificationsPage onOpen={goTab} />}
            {!page && tab === 'screen' && <ScreeningTab />}
            {!page && tab === 'history' && <HistoryTab isAdmin={isAdmin} />}
            {!page && tab === 'lists' && <ListsTab isAdmin={isAdmin} />}
            {!page && tab === 'people' && isAdmin && <UsersTab selfId={me.id} onPendingCount={onPendingCount} />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <SiteFooter />
    </div>
  )
}
