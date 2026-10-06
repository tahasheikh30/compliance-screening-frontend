import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getApplicant, listApplicants } from '../../api'
import ErrorBanner from '../../components/ErrorBanner'
import CaseReport from '../../components/CaseReport'
import { Pill } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'
import { overallInfo } from '../../lib/status'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ESCALATE_TO_COMPLIANCE', label: 'Escalated' },
  { id: 'MANUAL_REVIEW', label: 'Needs review' },
  { id: 'AUTO_CLEAR', label: 'Clear' },
]

export default function HistoryTab({ isAdmin = false }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [mine, setMine] = useState(false)           // administrators: only my own screenings
  const [selected, setSelected] = useState(null) // list row being viewed
  const [caseData, setCaseData] = useState(null)
  const [caseError, setCaseError] = useState(null)
  const [opening, setOpening] = useState(false)
  const headingRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listApplicants({ mine }))
    } catch (err) {
      setError(err)
    }
  }, [mine])

  useEffect(() => { load() }, [load])

  async function open(row) {
    setSelected(row)
    setCaseData(null)
    setCaseError(null)
    setOpening(true)
    try {
      setCaseData(await getApplicant(row.id))
    } catch (err) {
      setCaseError(err)
    } finally {
      setOpening(false)
    }
  }

  useEffect(() => {
    if (caseData) headingRef.current?.focus()
  }, [caseData])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (rows || []).filter((r) =>
      (filter === 'all' || r.overall_status === filter)
      && (!q || r.full_name.toLowerCase().includes(q) || (isAdmin && (r.screened_by || '').toLowerCase().includes(q))))
  }, [rows, query, filter, isAdmin])

  return (
    <div className="workspace workspace-history">
      <section className="sheet history" aria-labelledby="history-heading">
        <div className="folder-tab">History</div>
        <h1 id="history-heading">Past screenings</h1>

        <div className="history-tools">
          <label className="field" htmlFor="history-search">
            <span className="field-label">{isAdmin ? 'Search by name or screener' : 'Search by name'}</span>
            <input id="history-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </label>
          <div className="filter-group" role="group" aria-label="Filter by outcome">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-btn ${filter === f.id ? 'filter-btn-on' : ''}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="filter-group" role="group" aria-label="Whose screenings">
              <button type="button" className={`filter-btn ${!mine ? 'filter-btn-on' : ''}`} aria-pressed={!mine}
                onClick={() => { setMine(false); setSelected(null); setCaseData(null) }}>Everyone's</button>
              <button type="button" className={`filter-btn ${mine ? 'filter-btn-on' : ''}`} aria-pressed={mine}
                onClick={() => { setMine(true); setSelected(null); setCaseData(null) }}>Mine</button>
            </div>
          )}
        </div>

        <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
        {rows === null && !error && <p className="muted">Loading...</p>}
        {rows && rows.length === 0 && <p className="muted">{mine || !isAdmin ? 'You have not screened anyone yet. Run one from the Screening tab and it will appear here.' : 'No screenings yet.'}</p>}
        {rows && rows.length > 0 && shown.length === 0 && <p className="muted">No screenings match this search and filter.</p>}

        {shown.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Applicant</th><th scope="col">Outcome</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const info = overallInfo(r.overall_status)
                  const on = selected?.id === r.id
                  return (
                    <tr key={r.id} className={on ? 'row-on' : ''}>
                      <td>
                        <button type="button" className="row-btn" onClick={() => open(r)} aria-current={on ? 'true' : undefined}>
                          {r.full_name}
                        </button>
                        <span className="row-sub">{fmtDateTime(r.submitted_at)}</span>
                        <span className="row-sub mono">#{String(r.id).padStart(5, '0')}</span>
                        {isAdmin && <span className="row-sub">Screened by {r.screened_by || 'a removed account'}</span>}
                      </td>
                      <td><Pill tone={info.tone}>{info.stamp}</Pill></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="outcome" aria-live="polite">
        <ErrorBanner error={caseError} onRetry={selected ? () => open(selected) : undefined} onDismiss={() => setCaseError(null)} />
        {opening && <p className="muted">Opening case...</p>}
        {caseData && <CaseReport key={caseData.applicant_id} ref={headingRef} caseData={caseData} applicant={selected} />}
        {!opening && !caseData && !caseError && (
          <div className="empty"><h2>Open a case</h2><p>Select an applicant to see the full findings and download the evidence PDF.</p></div>
        )}
      </div>
    </div>
  )
}
