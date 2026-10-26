import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { getApplicant } from '../api'
import ErrorBanner from './ErrorBanner'
import CaseReport from './CaseReport'
import MonitorToggle from './MonitorToggle'
import ReviewPanel, { decisionLabel } from './ReviewPanel'
import { Pill } from './ui'
import { fmtDateTime } from '../lib/format'
import { overallInfo } from '../lib/status'
import { peek, remember } from '../lib/readCache'

// A long history is drawn a page at a time: hundreds of table rows are what makes typing in the search box lag.
const PAGE_SIZE = 100

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ESCALATE_TO_COMPLIANCE', label: 'Escalated' },
  { id: 'MANUAL_REVIEW', label: 'Needs review' },
  { id: 'AUTO_CLEAR', label: 'Clear' },
]

// One row. Memoised so a keystroke in the search box or selecting a case only redraws the rows that changed.
const HistoryRow = memo(function HistoryRow({ row, on, onOpen }) {
  const info = overallInfo(row.overall_status)
  return (
    <tr className={on ? 'row-on' : ''}>
      <td>
        <button type="button" className="row-btn" onClick={() => onOpen(row)} aria-current={on ? 'true' : undefined}>
          {row.full_name}
        </button>
        <span className="row-sub">{fmtDateTime(row.submitted_at)}</span>
        <span className="row-sub mono">#{String(row.id).padStart(5, '0')}</span>
        {row.review_decision && <span className="row-sub">Decision: {decisionLabel(row.review_decision)}</span>}
        {row.monitored && <span className="row-sub">Under continuous monitoring</span>}
      </td>
      <td><Pill tone={info.tone}>{info.stamp}</Pill></td>
    </tr>
  )
})

// The calendar day of a stored timestamp, as YYYY-MM-DD in the person's own time zone: what a date filter compares.
function dayOf(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The page: an optional AI search bar across the top, then two panels side by side. On the left the past
 * screenings, with a search by name and one collapsible Filter button holding every filter; on the right the
 * case that is open. Shared by the History tab (the signed in person's own screenings) and the page an
 * administrator opens for one person from the People tab.
 *
 *   load        () => Promise<rows>   how to fetch the list
 *   cacheKey    where the last answer is remembered, so reopening shows it at once (cleared on sign out)
 *   heading     the title of the list panel
 *   emptyText   what to say when there are no screenings at all
 *   canMonitor  show the monitoring switch on an opened case (only for the person's own screenings)
 *   lead        optional content above the search (a description or actions)
 *   searchBar   optional (open) => node, shown across the top of the page; `open` opens a history row
 *   above       optional content above everything, left aligned with it (a back button)
 */
export default function HistoryView({ load: fetchRows, cacheKey, heading, emptyText, canMonitor = false, lead = null, searchBar = null, above = null }) {
  const [rows, setRows] = useState(() => peek(cacheKey))   // the last answer, shown at once while it refreshes
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [from, setFrom] = useState('')                     // date filter, YYYY-MM-DD, inclusive
  const [to, setTo] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState(null)           // list row being viewed
  const [caseData, setCaseData] = useState(null)
  const [caseError, setCaseError] = useState(null)
  const [opening, setOpening] = useState(false)
  const headingRef = useRef(null)
  const latest = useRef(0)                                 // only the newest request may update the screen

  const load = useCallback(async () => {
    const mark = ++latest.current
    setError(null)
    try {
      const fresh = await fetchRows()
      if (mark !== latest.current) return                 // the list changed meanwhile: this answer is stale
      setRows(remember(cacheKey, fresh))
    } catch (err) {
      if (mark === latest.current) setError(err)
    }
  }, [fetchRows, cacheKey])

  useEffect(() => {
    setRows(peek(cacheKey))                                // another list's last answer (or the loading text) straight away
    setLimit(PAGE_SIZE)
    setSelected(null)
    setCaseData(null)
    setCaseError(null)
    load()
    return () => { latest.current += 1 }
  }, [load, cacheKey])

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

  const deferredQuery = useDeferredValue(query)            // typing stays responsive; the table catches up
  const matches = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return (rows || []).filter((r) => {
      if (filter !== 'all' && r.overall_status !== filter) return false
      if (q && !r.full_name.toLowerCase().includes(q)) return false
      if (from || to) {
        const day = dayOf(r.submitted_at)
        if (from && day < from) return false
        if (to && day > to) return false
      }
      return true
    })
  }, [rows, deferredQuery, filter, from, to])
  const shown = useMemo(() => matches.slice(0, limit), [matches, limit])

  // how many filters are set, shown on the Filter button so a closed panel still says the list is narrowed
  const activeFilters = (filter !== 'all' ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0)
  const clearFilters = () => { setFilter('all'); setFrom(''); setTo('') }

  // keep the row's monitoring flag in step when it is switched from the open case
  const onMonitoring = useCallback((id, monitored) => {
    setRows((all) => (all ? remember(cacheKey, all.map((r) => (r.id === id ? { ...r, monitored } : r))) : all))
  }, [cacheKey])

  // keep the row's decision in step when it is saved from the open case
  const onDecision = useCallback((id, review_decision) => {
    setRows((all) => (all ? remember(cacheKey, all.map((r) => (r.id === id ? { ...r, review_decision } : r))) : all))
  }, [cacheKey])

  return (
    <>
    {above && <div className="page-back">{above}</div>}
    {searchBar && <div className="history-top">{searchBar(open)}</div>}
    <div className="workspace workspace-history">
      <section className="sheet history" aria-labelledby="history-heading">
        <div className="folder-tab">History</div>
        {lead}
        <h1 id="history-heading">{heading}</h1>

        <div className="history-tools">
          <div className="history-search-row">
            <label className="field history-search" htmlFor="history-search">
              <span className="visually-hidden">Search by name</span>
              <input id="history-search" type="search" value={query} placeholder="Search by name"
                onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            </label>
            <button
              type="button"
              className={`btn btn-quiet btn-small filter-toggle ${filtersOpen ? 'filter-toggle-open' : ''}`}
              aria-expanded={filtersOpen}
              aria-controls="history-filters"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filter{activeFilters > 0 && <span className="filter-count" aria-label={`, ${activeFilters} applied`}>{activeFilters}</span>}
            </button>
          </div>

          <div id="history-filters" className="filter-panel" role="group" aria-label="Filters" hidden={!filtersOpen}>
            <div className="field">
              <span className="field-label" id="filter-outcome-label">Outcome</span>
              <div className="filter-group" role="group" aria-labelledby="filter-outcome-label">
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
            </div>
            <div className="field-row">
              <label className="field" htmlFor="filter-from">
                <span className="field-label">From</span>
                <input id="filter-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field" htmlFor="filter-to">
                <span className="field-label">To</span>
                <input id="filter-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
            <div className="filter-panel-actions">
              <button type="button" className="btn btn-quiet btn-small" onClick={clearFilters} disabled={activeFilters === 0}>
                Clear filters
              </button>
            </div>
          </div>
        </div>

        <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
        {rows === null && !error && <p className="muted state-note">Loading...</p>}
        {rows && rows.length === 0 && <p className="muted state-note">{emptyText}</p>}
        {rows && rows.length > 0 && matches.length === 0 && <p className="muted state-note">No screenings match this search and filter.</p>}

        {shown.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Applicant</th><th scope="col">Outcome</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <HistoryRow key={r.id} row={r} on={selected?.id === r.id} onOpen={open} />
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
        {opening && <p className="muted state-note">Opening case...</p>}
        {caseData && (
          <>
            <CaseReport key={caseData.applicant_id} ref={headingRef} caseData={caseData} applicant={selected} />
            <ReviewPanel key={`review-${caseData.applicant_id}`} applicantId={caseData.applicant_id}
              decision={caseData.review_decision} note={caseData.review_note} reviewedAt={caseData.reviewed_at}
              onChange={(d) => onDecision(caseData.applicant_id, d)} />
            {canMonitor && (
              <MonitorToggle key={caseData.applicant_id} applicantId={caseData.applicant_id}
                monitored={!!caseData.monitored} onChange={(m) => onMonitoring(caseData.applicant_id, m)} />
            )}
          </>
        )}
        {!opening && !caseData && !caseError && (
          <div className="empty"><h2>Open a case</h2><p>Select an applicant to see the full findings and download the evidence PDF.</p></div>
        )}
      </div>
    </div>
    </>
  )
}
