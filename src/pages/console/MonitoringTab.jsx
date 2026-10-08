import { useCallback, useEffect, useRef, useState } from 'react'
import { decideAlert, getMonitoringStatus, listAlerts } from '../../api'
import ErrorBanner from '../../components/ErrorBanner'
import { MatchItem } from '../../components/CaseReport'
import { Pill } from '../../components/ui'
import { fmtDateTime, plural } from '../../lib/format'
import { SOURCES } from '../../lib/status'
import { peek, remember } from '../../lib/readCache'
import { useToast } from '../../components/Toaster'

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'dismissed', label: 'Dismissed' },
]

const DECIDED = {
  confirmed: { tone: 'bad', label: 'Confirmed match' },
  dismissed: { tone: 'good', label: 'Dismissed' },
}

function minutes(seconds) {
  const m = Math.round(Number(seconds) / 60)
  return m < 60 ? plural(m, 'minute', 'minutes') : plural(Math.round(m / 60), 'hour', 'hours')
}

/** One alert: a person who was clear (or already known) when screened, and a NEW potential match found later. */
function AlertCard({ alert, busy, onDecide }) {
  const [note, setNote] = useState('')
  const source = SOURCES[alert.source]
  const decided = DECIDED[alert.status]
  const match = alert.match
  return (
    <li className="alert-card">
      <div className="alert-head">
        <div>
          <h2 className="alert-name">{alert.applicant_name}</h2>
          <p className="row-sub">
            New match on {source?.name || alert.source}{alert.list ? `, ${alert.list}` : ''}. Found {fmtDateTime(alert.created_at)}.
          </p>
        </div>
        <div className="alert-tags">
          {decided ? <Pill tone={decided.tone}>{decided.label}</Pill> : <Pill tone="warn">Needs review</Pill>}
          {alert.score != null && <span className="match-name-score">Name similarity {alert.score}</span>}
        </div>
      </div>

      <p className="alert-matched">
        Listed as <strong>{alert.matched_name || (match && match.primary_name) || 'an unnamed entry'}</strong>
      </p>

      {match && (
        <details className="alert-details">
          <summary>Show the listed person's details</summary>
          <ul className="matches"><MatchItem match={match} applicantHasDob={false} /></ul>
        </details>
      )}

      {alert.status !== 'open' && (
        <p className="row-sub">
          {alert.decided_at ? `Decided ${fmtDateTime(alert.decided_at)}. ` : ''}{alert.note ? `Note: ${alert.note}` : ''}
        </p>
      )}

      {alert.status === 'open' ? (
        <div className="alert-decide">
          <label className="field" htmlFor={`alert-note-${alert.id}`}>
            <span className="field-label">Note (optional)</span>
            <input id={`alert-note-${alert.id}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Different date of birth, confirmed with the applicant" autoComplete="off" />
          </label>
          <div className="row-actions">
            <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => onDecide(alert, 'confirmed', note)}>
              Confirm: this is the same person
            </button>
            <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => onDecide(alert, 'dismissed', note)}>
              Dismiss: someone else
            </button>
          </div>
        </div>
      ) : (
        <div className="row-actions">
          <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => onDecide(alert, 'open')}>
            Reopen
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * Continuous monitoring results. People who were screened and then put under watch are screened again whenever a
 * sanctions list changes; a new potential match lands here. Only the alerts on the signed in person's own
 * screenings are shown, an administrator included.
 */
export default function MonitoringTab({ onOpenCount }) {
  const toast = useToast()
  const [filter, setFilter] = useState('open')
  const [status, setStatus] = useState(() => peek('monitoring:status'))
  const [alerts, setAlerts] = useState(() => peek('monitoring:alerts:open'))
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const latest = useRef(0)

  const loadStatus = useCallback(async () => {
    try {
      const s = remember('monitoring:status', await getMonitoringStatus())
      setStatus(s)
      onOpenCount?.(s.open_alerts)
    } catch (err) {
      setError(err)
    }
  }, [onOpenCount])

  const loadAlerts = useCallback(async () => {
    const mark = ++latest.current
    setError(null)
    try {
      const rows = await listAlerts(filter)
      if (mark !== latest.current) return                       // another filter was chosen meanwhile
      setAlerts(remember(`monitoring:alerts:${filter}`, rows))
    } catch (err) {
      if (mark === latest.current) setError(err)
    }
  }, [filter])

  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => {
    setAlerts(peek(`monitoring:alerts:${filter}`))
    loadAlerts()
    return () => { latest.current += 1 }
  }, [loadAlerts, filter])

  async function decide(alert, next, note) {
    setBusyId(alert.id)
    setError(null)
    try {
      await decideAlert(alert.id, next, note?.trim())
      toast.success(next === 'confirmed' ? 'Marked as a confirmed match' : next === 'dismissed' ? 'Alert dismissed' : 'Alert reopened',
        { message: alert.applicant_name, log: false })
      await Promise.all([loadAlerts(), loadStatus()])
      // the other lists are out of date now
      ;['open', 'confirmed', 'dismissed'].filter((f) => f !== filter).forEach((f) => remember(`monitoring:alerts:${f}`, null))
    } catch (err) {
      setError(err)
      toast.error('Could not save the decision', { message: err?.message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="workspace workspace-single">
      <section className="sheet monitoring" aria-labelledby="monitoring-heading">
        <div className="folder-tab">Monitoring</div>
        <h1 id="monitoring-heading">Continuous monitoring</h1>
        <p className="lead">
          People you chose to keep watching are screened again whenever a sanctions list changes. A new potential match
          appears here and as a notification. Only your own screenings are monitored and shown.
        </p>

        {status && !status.enabled && (
          <p className="notice notice-warn">Automatic checking is switched off on the server, so no new matches will be found until it is turned back on.</p>
        )}
        {status && (
          <>
            <p className="monitor-summary" role="status">
              Watching <strong>{plural(status.monitored_applicants, 'person', 'people')}</strong>.{' '}
              <strong>{plural(status.open_alerts, 'alert', 'alerts')}</strong> to review. Lists are checked for changes about every {minutes(status.interval_seconds)}.
            </p>
            <details className="monitor-sources">
              <summary>When each list was last checked</summary>
              <ul>
                {status.sources.filter((s) => s.source !== 'ADVERSE_MEDIA').map((s) => (
                  <li key={s.source}>
                    <span>{SOURCES[s.source]?.name || s.source}</span>
                    <span className="muted">{s.last_checked_at ? fmtDateTime(s.last_checked_at) : 'Not checked yet'}</span>
                  </li>
                ))}
              </ul>
              <p className="field-hint">News (adverse media) is not part of monitoring. Screen the person again by hand for a fresh news check.</p>
            </details>
          </>
        )}

        <div className="filter-group" role="group" aria-label="Show alerts">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`filter-btn ${filter === f.id ? 'filter-btn-on' : ''}`}
              aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}{f.id === 'open' && status?.open_alerts > 0 ? ` (${status.open_alerts})` : ''}
            </button>
          ))}
        </div>

        <ErrorBanner error={error} onRetry={() => { loadStatus(); loadAlerts() }} onDismiss={() => setError(null)} />
        {alerts === null && !error && <p className="muted">Loading...</p>}
        {alerts && alerts.length === 0 && (
          <p className="muted">
            {filter === 'open'
              ? (status && status.monitored_applicants === 0
                ? 'Nobody is being monitored yet. Tick "Keep monitoring this person" when you screen someone, or start monitoring from an opened case in History.'
                : 'No alerts to review. You will be told here when a list change brings up a new match.')
              : `No ${filter} alerts.`}
          </p>
        )}
        {alerts && alerts.length > 0 && (
          <ul className="alert-list">
            {alerts.map((a) => <AlertCard key={a.id} alert={a} busy={busyId === a.id} onDecide={decide} />)}
          </ul>
        )}
      </section>
    </div>
  )
}
