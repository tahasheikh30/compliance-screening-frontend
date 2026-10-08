import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { getApplicant, listApplicants } from '../../api'
import ErrorBanner from '../../components/ErrorBanner'
import CaseReport from '../../components/CaseReport'
import { Pill } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'
import { overallInfo } from '../../lib/status'
import { peek, remember } from '../../lib/readCache'

// A long history is drawn a page at a time: hundreds of table rows are what makes typing in the search box lag.
const PAGE_SIZE = 100
const cacheKey = (mine) => `history:${mine ? 'mine' : 'all'}`

// One row. Memoised so a keystroke in the search box or selecting a case only redraws the rows that changed.
const HistoryRow = memo(function HistoryRow({ row, on, isAdmin, onOpen }) {
  const info = overallInfo(row.overall_status)
  return (
    <tr className={on ? 'row-on' : ''}>
      <td>
        <button type="button" className="row-btn" onClick={() => onOpen(row)} aria-current={on ? 'true' : undefined}>
          {row.full_name}
        </button>
        <span className="row-sub">{fmtDateTime(row.submitted_at)}</span>
        <span className="row-sub mono">#{String(row.id).padStart(5, '0')}</span>
        {isAdmin && <span className="row-sub">Screened by {row.screened_by || 'a removed account'}</span>}
      </td>
      <td><Pill tone={info.tone}>{info.stamp}</Pill></td>
    </tr>
  )
})

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ESCALATE_TO_COMPLIANCE', label: 'Escalated' },
  { id: 'MANUAL_REVIEW', label: 'Needs review' },
  { id: 'AUTO_CLEAR', label: 'Clear' },
]

export default function HistoryTab({ isAdmin = false }) {
  const [mine, setMine] = useState(false)           // administrators: only my own screenings
  const [rows, setRows] = useState(() => peek(cacheKey(false)))   // the last answer, shown at once while it refreshes
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState(null) // list row being viewed
  const [caseData, setCaseData] = useState(null)
  const [caseError, setCaseError] = useState(null)
  const [opening, setOpening] = useState(false)
  const headingRef = useRef(null)

  const latest = useRef(0)                          // only the newest request may update the screen

  const load = useCallback(async () => {
    const mark = ++latest.current
    setError(null)
    try {
      const fresh = await listApplicants({ mine })
      if (mark !== latest.current) return          // switched to Everyone's / Mine meanwhile: this answer is stale
      setRows(remember(cacheKey(mine), fresh))
    } catch (err) {
      if (mark === latest.current) setError(err)
    }
  }, [mine])

  useEffect(() => {
    setRows(peek(cacheKey(mine)))                  // show the other list's last answer (or the loading text) straight away
    setLimit(PAGE_SIZE)
    load()
    return () => { latest.current += 1 }
  }, [load, mine])

  const open = useCallback(async (row) => {
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
  }, [])

  useEffect(() => {
    if (caseData) headingRef.current?.focus()
  }, [caseData])

  const deferredQuery = useDeferredValue(query)      // typing stays responsive; the table catches up
  const matches = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return (rows || []).filter((r) =>
      (filter === 'all' || r.overall_status === filter)
      && (!q || r.full_name.toLowerCase().includes(q) || (isAdmin && (r.screened_by || '').toLowerCase().includes(q))))
  }, [rows, deferredQuery, filter, isAdmin])
  const shown = useMemo(() => matches.slice(0, limit), [matches, limit])

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
        {rows && rows.length > 0 && matches.length === 0 && <p className="muted">No screenings match this search and filter.</p>}

        {shown.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Applicant</th><th scope="col">Outcome</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <HistoryRow key={r.id} row={r} on={selected?.id === r.id} isAdmin={isAdmin} onOpen={open} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {matches.length > shown.length && (
          <div className="form-actions form-actions-spaced">
            <button type="button" className="btn btn-quiet" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              Show more ({matches.length - shown.length} more)
            </button>
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
