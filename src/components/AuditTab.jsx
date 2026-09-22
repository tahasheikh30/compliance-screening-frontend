import { useCallback, useEffect, useState } from 'react'
import { listNearMisses, listAdminActivity, refreshList, refreshAll } from '../api'
import ErrorBanner from './ErrorBanner'

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const SOURCE_LABELS = { UNSC: 'UNSC', OFAC: 'OFAC', UKSL: 'UKSL' }

function RefreshRow() {
  const [busy, setBusy] = useState(null) // which source is refreshing, or 'all'
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function run(source) {
    setBusy(source)
    setError(null)
    setResult(null)
    try {
      const res = source === 'all' ? await refreshAll() : await refreshList(source)
      setResult({ source, res })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fia-section">
      <div className="fia-section-heading">
        <h2>Sanctions list feeds</h2>
        <div className="audit-refresh-buttons">
          {['unsc', 'ofac', 'uksl'].map((s) => (
            <button key={s} type="button" className="fia-btn-compact" disabled={!!busy} onClick={() => run(s)}>
              {busy === s ? 'Refreshing…' : `Refresh ${SOURCE_LABELS[s]}`}
            </button>
          ))}
          <button type="button" className="fia-btn-compact" disabled={!!busy} onClick={() => run('all')}>
            {busy === 'all' ? 'Refreshing all…' : 'Refresh all + check FIA site'}
          </button>
        </div>
      </div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {result && (
        <p className="fia-check-result">
          {result.source === 'all'
            ? Object.entries(result.res).map(([k, v]) => `${k}: ${v.error ? `failed (${v.error})` : 'ok'}`).join(' · ')
            : `${SOURCE_LABELS[result.source]} refreshed (${result.res.bytes ?? '?'} bytes).`}
        </p>
      )}
    </div>
  )
}

export default function AuditTab() {
  const [nearMisses, setNearMisses] = useState(null)
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nm, act] = await Promise.all([listNearMisses(100), listAdminActivity(100)])
      setNearMisses(nm)
      setActivity(act)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="folder">
      <div className="folder-tab">Lists &amp; Audit</div>
      <header className="folder-header">
        <h1>Lists &amp; audit trail</h1>
        <p className="folder-meta">Feed refreshes, near-miss scores, and who changed what.</p>
      </header>

      <RefreshRow />

      <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
      {loading && <p className="fia-loading-note">Loading…</p>}

      {!loading && (
        <>
          <section className="fia-section">
            <h2>Admin activity</h2>
            <p className="fia-upload-hint">Uploads, activations, discards, and list refreshes — who, when, and from where.</p>
            {activity?.length === 0 && <p className="fia-no-warnings">No admin activity recorded yet.</p>}
            {activity?.length > 0 && (
              <table className="fia-entries-table">
                <thead><tr><th>When</th><th>Action</th><th>Target</th><th>Detail</th><th>From</th></tr></thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDate(a.logged_at)}</td>
                      <td>{a.action.replace(/_/g, ' ')}</td>
                      <td className="audit-mono">{a.target || '—'}</td>
                      <td>{a.detail || '—'}</td>
                      <td className="audit-mono">{a.client_ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="fia-section">
            <h2>Near-miss log</h2>
            <p className="fia-upload-hint">
              Scores that came close to a threshold without crossing it — useful for sanity-checking
              whether the thresholds in the backend config are set where compliance wants them.
            </p>
            {nearMisses?.length === 0 && <p className="fia-no-warnings">No near-misses logged yet.</p>}
            {nearMisses?.length > 0 && (
              <table className="fia-entries-table">
                <thead><tr><th>When</th><th>Source</th><th>Matched entry</th><th>Score</th><th>Threshold</th></tr></thead>
                <tbody>
                  {nearMisses.map((n) => (
                    <tr key={n.id}>
                      <td>{fmtDate(n.logged_at)}</td>
                      <td>{n.source}</td>
                      <td>{n.matched_entry || '—'}</td>
                      <td>{n.score != null ? Math.round(n.score) : '—'}</td>
                      <td>{n.threshold != null ? Math.round(n.threshold) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}
