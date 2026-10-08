import { useEffect, useRef } from 'react'
import { ToneIcon, useNotifications } from '../../components/Toaster'

function when(at) {
  const secs = Math.round((Date.now() - at.getTime()) / 1000)
  if (secs < 60) return 'Just now'
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`
  return at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const WHERE = { screen: 'Screening', history: 'History', monitoring: 'Monitoring', lists: 'Lists', people: 'People' }

/** Everything that popped up as a message this session, newest first. Opening the page marks it all read. */
export default function NotificationsPage({ onOpen }) {
  const { notifications, markAllRead, clearAll } = useNotifications()

  // remember what was new when the page opened, so those rows stay highlighted after being marked read
  const fresh = useRef(null)
  if (fresh.current === null) fresh.current = new Set(notifications.filter((n) => !n.read).map((n) => n.id))

  useEffect(() => { markAllRead() }, [notifications, markAllRead])

  return (
    <div className="workspace workspace-single">
      <section className="sheet" aria-labelledby="notif-heading">
        <div className="folder-tab">Notifications</div>
        <div className="notif-top">
          <h1 id="notif-heading">Notifications</h1>
          {notifications.length > 0 && (
            <button type="button" className="btn btn-quiet btn-small" onClick={clearAll}>Clear all</button>
          )}
        </div>
        <p className="lead">Messages from this session. They are kept in this browser tab only and are gone when you reload or sign out.</p>

        {notifications.length === 0 ? (
          <div className="notif-empty">
            <p className="notif-empty-title">You are all caught up</p>
            <p className="muted">Screening results, list updates and account changes will show up here.</p>
          </div>
        ) : (
          <ul className="notif-list">
            {notifications.map((n) => (
              <li key={n.id} className={`notif notif-${n.tone}${fresh.current.has(n.id) ? ' notif-new' : ''}`}>
                <span className="notif-icon"><ToneIcon tone={n.tone} /></span>
                <div className="notif-body">
                  <p className="notif-title">{n.title}</p>
                  {n.message && <p className="notif-message">{n.message}</p>}
                  <p className="notif-time">{when(n.at)}</p>
                </div>
                {n.to && WHERE[n.to] && (
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => onOpen(n.to)}>
                    Open {WHERE[n.to]}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
