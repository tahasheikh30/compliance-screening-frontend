import { useEffect, useRef, useState } from 'react'
import { usePreferences } from '../../lib/preferences'
import AccountSection from './AccountSection'
import DisplaySection from './DisplaySection'
import ListsSection from './ListsSection'
import NotificationsSection from './NotificationsSection'
import ScreeningSection from './ScreeningSection'
import SecuritySection from './SecuritySection'

function Icon({ children }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  )
}

export const SECTIONS = [
  { id: 'account', label: 'Account', Component: AccountSection,
    icon: <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></Icon> },
  { id: 'notifications', label: 'Notifications', Component: NotificationsSection,
    icon: <Icon><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" /></Icon> },
  { id: 'lists', label: 'Lists', Component: ListsSection,
    icon: <Icon><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></Icon> },
  { id: 'screening', label: 'Screening', Component: ScreeningSection,
    icon: <Icon><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></Icon> },
  { id: 'security', label: 'Security', Component: SecuritySection,
    icon: <Icon><path d="M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z" /></Icon> },
  { id: 'display', label: 'Display', Component: DisplaySection,
    icon: <Icon><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon> },
]

const FOCUSABLE = 'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'

/**
 * The settings window, opened from the profile menu. A sidebar lists the sections and the right side shows the one
 * chosen. Changes save by themselves a moment after they are made. Escape or a click outside closes it, Tab stays
 * inside it, and focus goes back to where it was.
 */
export default function SettingsModal({ initial = 'account', onClose }) {
  const [active, setActive] = useState(SECTIONS.some((s) => s.id === initial) ? initial : 'account')
  const { saving, loadFailed, reload } = usePreferences()
  const dialog = useRef(null)
  const body = useRef(null)
  const first = useRef(null)

  useEffect(() => {
    const before = document.activeElement
    first.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e) {
      if (document.getElementById('confirm-dialog-title')) return      // a confirmation on top handles its own keys
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Tab') {
        const list = Array.from(dialog.current?.querySelectorAll(FOCUSABLE) || []).filter((el) => !el.disabled)
        if (list.length === 0) return
        const firstEl = list[0]
        const lastEl = list[list.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      before?.focus?.()
    }
  }, [onClose])

  function choose(id) {
    setActive(id)
    body.current?.scrollTo?.({ top: 0 })
  }

  const section = SECTIONS.find((s) => s.id === active) || SECTIONS[0]
  const Section = section.Component

  return (
    <div
      className="policy-overlay settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="settings-modal" ref={dialog}>
        <aside className="settings-side">
          <h2 id="settings-title">Settings</h2>
          <nav aria-label="Settings sections" className="settings-nav">
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                ref={i === 0 ? first : undefined}
                type="button"
                className={`settings-nav-item${s.id === active ? ' settings-nav-on' : ''}`}
                aria-current={s.id === active ? 'page' : undefined}
                onClick={() => choose(s.id)}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
          <p className="settings-saved" role="status" aria-live="polite">{saving ? 'Saving...' : 'Changes save automatically.'}</p>
        </aside>
        <div className="settings-main">
          <header className="settings-head">
            <h2 id="settings-section-title">{section.label}</h2>
            <button type="button" className="settings-close" aria-label="Close settings" onClick={onClose}>
              <Icon><path d="M6 6l12 12M18 6L6 18" /></Icon>
            </button>
          </header>
          <div className="settings-body" ref={body}>
            {loadFailed && (
              <p className="notice notice-warn" role="alert">
                Your saved settings could not be loaded, so changes are not saved yet.{' '}
                <button type="button" className="link-btn" onClick={reload}>Try again</button>
              </p>
            )}
            <Section />
          </div>
        </div>
      </div>
    </div>
  )
}
