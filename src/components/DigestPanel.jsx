import { useEffect, useState } from 'react'
import { getDigest } from '../api'
import { plural } from '../lib/format'

/** A summary of the last week's monitoring alerts: exact counts always, and a short narrative when AI search is on. */
export default function DigestPanel() {
  const [days, setDays] = useState(7)
  const [digest, setDigest] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setError(null)
    getDigest(days).then((d) => { if (active) setDigest(d) }).catch((e) => { if (active) setError(e) })
    return () => { active = false }
  }, [days])

  const s = digest?.stats
  const n = digest?.narrative
  return (
    <section className="digest" aria-labelledby="digest-heading">
      <header className="ai-panel-head">
        <h2 id="digest-heading">Digest</h2>
        <label className="field-hint" htmlFor="digest-days">Last{' '}
          <select id="digest-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
        </label>
      </header>
      {error && <p className="field-hint"> The digest could not be loaded just now.</p>}
      {s && (
        <>
          <p>
            {s.total === 0
              ? 'No monitoring alerts in this period.'
              : `${plural(s.total, 'alert', 'alerts')} on ${plural(s.people, 'person', 'people')}: ${s.open} open, ${s.confirmed} confirmed, ${s.dismissed} dismissed.`}
            {s.open > 0 && s.oldest_open_days > 0 && ` The oldest open one is ${plural(s.oldest_open_days, 'day', 'days')} old.`}
          </p>
          {n && (
            <div className="digest-narrative">
              <p><strong>{n.headline}</strong> <span className="field-hint">(written by AI)</span></p>
              {n.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              {n.priorities.length > 0 && (
                <ol>{n.priorities.map((p) => <li key={p.case_ref}><span className="mono">{p.case_ref}</span> {p.why}</li>)}</ol>
              )}
            </div>
          )}
          {!n && digest.open_alerts.length > 0 && (
            <ul>{digest.open_alerts.map((a) => <li key={a.id}><span className="mono">{a.case_ref}</span> {a.matched_name} on {a.list}, {a.score}%</li>)}</ul>
          )}
        </>
      )}
    </section>
  )
}
