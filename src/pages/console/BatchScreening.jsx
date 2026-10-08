import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cancelBatch, downloadBatchEvidence, downloadBatchResults, getApplicant, getBatch, startBatch } from '../../api'
import CaseReport from '../../components/CaseReport'
import ErrorBanner from '../../components/ErrorBanner'
import MonitorToggle from '../../components/MonitorToggle'
import { useToast } from '../../components/Toaster'
import { Pill } from '../../components/ui'
import { ApiError } from '../../lib/apiError'
import { fmtNum } from '../../lib/format'
import { forget, peek, remember } from '../../lib/readCache'
import { overallInfo, SOURCE_ORDER } from '../../lib/status'

const DEFAULT_THRESHOLD = 85
const POLL_MS = 1500
const ACTIVE_KEY = 'batch:active'            // the batch on screen, remembered in memory only (never storage)
const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = '.xlsx,.xls,.csv,.docx'
const KINDS = { xlsx: 'Excel', xls: 'Excel', csv: 'CSV', docx: 'Word' }

const COLUMNS = [
  { name: 'Full name', required: true, note: 'As written on the ID' },
  { name: 'Date of birth', note: 'YYYY-MM-DD' },
  { name: 'Nationality', note: 'e.g. Pakistan' },
  { name: 'CNIC', note: '13 digits, dashes optional' },
  { name: 'Father or husband', note: 'Name' },
  { name: 'Province', note: 'e.g. Punjab' },
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ESCALATE_TO_COMPLIANCE', label: 'Escalated' },
  { id: 'MANUAL_REVIEW', label: 'Needs review' },
  { id: 'AUTO_CLEAR', label: 'Clear' },
  { id: 'NOT_SCREENED', label: 'Not screened' },
]

/** A row that was not screened is never "clear": it is invalid, failed, or was not reached. */
const isScreened = (r) => r.state === 'screened'
const outcomeOf = (r) => (isScreened(r) ? r.overall_status : 'NOT_SCREENED')

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '')
  return m ? m[1].toLowerCase() : ''
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} MB`
}

/** The columns as a CSV a person can open in Excel and fill in. Built in the browser: no request is made. */
function downloadTemplate() {
  const header = COLUMNS.map((c) => c.name).join(',')
  const blob = new Blob([`${header}\r\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'screening-template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function UploadIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  )
}

function Guide() {
  return (
    <div className="empty batch-guide">
      <h2>How batch screening works</h2>
      <ol className="batch-steps">
        <li><span><span className="batch-step-title">Prepare the file.</span> One applicant per row in Excel, or one row per applicant in a Word table. Put the column names in the first row.</span></li>
        <li><span><span className="batch-step-title">Upload and set the threshold.</span> The same match threshold applies to every row.</span></li>
        <li><span><span className="batch-step-title">Review the results.</span> Each row gets a verdict. Open any row for the full case and its evidence PDF.</span></li>
      </ol>

      <h3 className="batch-sub">What the file should contain</h3>
      <ul className="batch-cols">
        {COLUMNS.map((c) => (
          <li key={c.name}>
            <span className="batch-col-name">{c.name}</span>
            <span className={`pill ${c.required ? 'pill-warn' : 'pill-good'} batch-col-tag`}>{c.required ? 'Required' : 'Optional'}</span>
            <span className="batch-col-note">{c.note}</span>
          </li>
        ))}
      </ul>
      <p>
        Every row is checked against the same {SOURCE_ORDER.length} sources as an individual screening, with the same rules. A
        source that cannot be read is reported as not screened, never as clear.
      </p>
      <button type="button" className="btn btn-quiet btn-small batch-template" onClick={downloadTemplate}>Download a template</button>
    </div>
  )
}

function Progress({ batch, reading, stopping, onCancel }) {
  const total = batch?.total || 0
  const done = batch?.done || 0
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="scan batch-progress" role="status" aria-live="polite">
      <p className="scan-title">{reading ? 'Reading the file' : 'Screening the file'}</p>
      <p className="scan-sub">
        {reading
          ? 'Uploading it and checking every row.'
          : <>Row <span className="scan-clock">{done}</span> of <span className="scan-clock">{total}</span>. Each row is checked against every list.</>}
        {stopping && ' Stopping after the row in progress.'}
      </p>
      <div className="bar" role="progressbar" aria-label="Batch progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {!reading && <button type="button" className="btn btn-quiet btn-small" disabled={stopping} onClick={onCancel}>{stopping ? 'Stopping...' : 'Cancel'}</button>}
    </div>
  )
}

const HEADLINE = { done: 'Batch screened', cancelled: 'Batch cancelled', interrupted: 'Batch interrupted' }
const NOT_FINISHED = {
  cancelled: 'It was cancelled. Rows not reached are listed as not screened, never as clear.',
  interrupted: 'The server restarted while it was running. Rows not reached are listed as not screened, never as clear.',
}

function Results({ batch, onNew, onOpen }) {
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)               // 'results' | 'evidence' while a download runs
  const [downloadError, setDownloadError] = useState(null)
  const rows = batch.rows
  const count = (id) => rows.filter((r) => outcomeOf(r) === id).length
  const shown = useMemo(() => rows.filter((r) => filter === 'all' || outcomeOf(r) === filter), [rows, filter])
  const notScreened = count('NOT_SCREENED')
  const hasEvidence = count('ESCALATE_TO_COMPLIANCE') + count('MANUAL_REVIEW') > 0

  async function download(kind) {
    setBusy(kind)
    setDownloadError(null)
    try {
      await (kind === 'results' ? downloadBatchResults(batch.id) : downloadBatchEvidence(batch.id))
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EVIDENCE_NOT_GENERATED') {
        toast.info('No evidence PDFs', { message: 'An evidence PDF is only made when a row has a match or an adverse news lead.', log: false })
      } else {
        setDownloadError(err)
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="report batch-report" aria-labelledby="batch-report-heading">
      <header className={`verdict ${count('ESCALATE_TO_COMPLIANCE') ? 'verdict-bad' : 'verdict-warn'}`}>
        <div className="verdict-text">
          <p className="verdict-ref"><span className="mono">{batch.filename}</span></p>
          <h2 id="batch-report-heading" tabIndex={-1}>{HEADLINE[batch.status] || 'Batch screened'}</h2>
          <p className="verdict-applicant">{fmtNum(batch.total)} rows<span className="verdict-sub">{count('ESCALATE_TO_COMPLIANCE')} need escalating</span></p>
        </div>
      </header>

      {NOT_FINISHED[batch.status] && <p className="batch-note" role="note">{NOT_FINISHED[batch.status]}</p>}

      <dl className="tally">
        <div><dt>Rows in file</dt><dd>{fmtNum(batch.total)}</dd></div>
        <div><dt>Escalate</dt><dd className={count('ESCALATE_TO_COMPLIANCE') ? 'tally-bad' : ''}>{count('ESCALATE_TO_COMPLIANCE')}</dd></div>
        <div><dt>Review</dt><dd className={count('MANUAL_REVIEW') ? 'tally-warn' : ''}>{count('MANUAL_REVIEW')}</dd></div>
        <div><dt>Clear</dt><dd>{count('AUTO_CLEAR')}</dd></div>
        {notScreened > 0 && <div><dt>Not screened</dt><dd className="tally-warn">{notScreened}</dd></div>}
      </dl>

      {notScreened > 0 && (
        <p className="batch-note" role="note">
          {notScreened === 1 ? '1 row was' : `${notScreened} rows were`} not screened. Fix {notScreened === 1 ? 'it' : 'them'} in the
          file and upload again. {notScreened === 1 ? 'It is' : 'They are'} not counted as clear.
        </p>
      )}

      <div className="batch-toolbar">
        <div className="filter-group" role="group" aria-label="Filter by outcome">
          {FILTERS.filter((f) => f.id !== 'NOT_SCREENED' || notScreened > 0).map((f) => (
            <button key={f.id} type="button" className={`filter-btn ${filter === f.id ? 'filter-btn-on' : ''}`}
              aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}{f.id !== 'all' && <span className="filter-count"> {count(f.id)}</span>}
            </button>
          ))}
        </div>
        <div className="batch-downloads">
          <button type="button" className="btn btn-primary btn-small" disabled={busy !== null} onClick={() => download('results')}>
            {busy === 'results' ? 'Preparing...' : 'Download results (.xlsx)'}
          </button>
          <button type="button" className="btn btn-quiet btn-small" disabled={busy !== null || !hasEvidence} onClick={() => download('evidence')}>
            {busy === 'evidence' ? 'Preparing...' : 'Evidence (.zip)'}
          </button>
        </div>
      </div>
      <ErrorBanner error={downloadError} onDismiss={() => setDownloadError(null)} />

      <div className="table-wrap">
        <table className="table batch-table">
          <thead>
            <tr>
              <th scope="col" className="num">Row</th>
              <th scope="col">Applicant</th>
              <th scope="col">Outcome</th>
              <th scope="col" className="num">Matches</th>
              <th scope="col" className="num">News</th>
              <th scope="col"><span className="visually-hidden">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const screened = isScreened(r)
              const info = overallInfo(r.overall_status)
              return (
                <tr key={r.row}>
                  <td className="num mono">{r.row}</td>
                  <td>
                    <span className="batch-name">{r.full_name || 'No name'}</span>
                    {!screened && <span className="batch-why">{r.error || 'Not reached before the batch stopped.'}</span>}
                  </td>
                  <td>{screened ? <Pill tone={info.tone}>{info.stamp}</Pill> : <Pill tone="warn">Not screened</Pill>}</td>
                  <td className="num">{screened ? r.sanctions : ''}</td>
                  <td className="num">{screened ? r.news : ''}</td>
                  <td className="num">
                    {screened && <button type="button" className="row-btn batch-open" onClick={() => onOpen(r)}>View case</button>}
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="batch-none">No rows match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="form-actions form-actions-spaced">
        <button type="button" className="btn btn-quiet" onClick={onNew}>Screen another file</button>
      </div>
    </section>
  )
}

/** One row's full case, with its evidence PDF, in place of the results until the person goes back. */
function CaseView({ row, onBack }) {
  const [caseData, setCaseData] = useState(null)
  const [error, setError] = useState(null)
  const headingRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setCaseData(await getApplicant(row.applicant_id))
    } catch (err) {
      setError(err)
    }
  }, [row.applicant_id])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (caseData) headingRef.current?.focus() }, [caseData])

  return (
    <>
      <div className="form-actions batch-back">
        <button type="button" className="btn btn-quiet btn-small" onClick={onBack}>Back to the batch results</button>
      </div>
      <ErrorBanner error={error} onRetry={load} onDismiss={() => setError(null)} />
      {!caseData && !error && <p className="muted state-note">Opening case...</p>}
      {caseData && (
        <>
          <CaseReport key={caseData.applicant_id} ref={headingRef} caseData={caseData} applicant={row} />
          <MonitorToggle key={`monitor-${caseData.applicant_id}`} applicantId={caseData.applicant_id} monitored={!!caseData.monitored} />
        </>
      )}
    </>
  )
}

export default function BatchScreening() {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [monitor, setMonitor] = useState(false)
  const [uploading, setUploading] = useState(false)     // the file is on its way to the server
  const [batch, setBatch] = useState(null)              // the batch on screen, as the server last reported it
  const [stopping, setStopping] = useState(false)       // Cancel was pressed; the row in progress still finishes
  const [pollError, setPollError] = useState(null)
  const [openRow, setOpenRow] = useState(null)

  const running = uploading || batch?.status === 'running'

  // Coming back to this tab (or this page) while a batch is on screen: pick it up where it is. The batch keeps
  // running on the server whether or not this page is open.
  useEffect(() => {
    const id = peek(ACTIVE_KEY)
    if (!id) return undefined
    let alive = true
    getBatch(id)
      .then((b) => { if (alive) setBatch(b) })
      .catch(() => forget(ACTIVE_KEY))
    return () => { alive = false }
  }, [])

  // While it runs, ask for progress. Each answer replaces `batch`, which re-arms the next ask; a failed ask is
  // shown and retried more slowly, so a hiccup does not lose the batch.
  useEffect(() => {
    if (batch?.status !== 'running') return undefined
    let alive = true
    let timer
    const ask = async () => {
      try {
        const next = await getBatch(batch.id)
        if (!alive) return
        setPollError(null)
        setBatch(next)
        if (next.status !== 'running') finished(next)
      } catch (err) {
        if (!alive) return
        if (err instanceof ApiError && err.status === 404) {
          forget(ACTIVE_KEY)
          setBatch(null)
          setError(err)
          return
        }
        setPollError(err)
        timer = setTimeout(ask, POLL_MS * 3)
      }
    }
    timer = setTimeout(ask, POLL_MS)
    return () => { alive = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch])

  function finished(b) {
    forget('history:')                       // the batch's screenings are new history rows
    setStopping(false)
    const escalate = b.counts?.ESCALATE_TO_COMPLIANCE || 0
    const title = b.status === 'done' ? 'Batch screened' : b.status === 'cancelled' ? 'Batch cancelled' : 'Batch interrupted'
    const message = `${b.filename}. ${fmtNum(b.counts?.screened || 0)} of ${fmtNum(b.total)} rows screened, ${escalate} to escalate.`
    if (b.status === 'done' && escalate === 0) toast.success(title, { message, to: 'history' })
    else toast.warn(title, { message, to: 'history' })
  }

  function refuse(message, hint) {
    setError(new ApiError({ code: 'VALIDATION_ERROR', message, hint }))
  }

  function accept(list) {
    setError(null)
    if (!list || list.length === 0) return
    if (list.length > 1) return refuse('Upload one file at a time.', 'Put every applicant in the same file.')
    const f = list[0]
    if (!KINDS[extOf(f.name)]) return refuse('That file type is not supported.', 'Use an Excel file (.xlsx or .xls), a CSV, or a Word file (.docx).')
    if (f.size === 0) return refuse('That file is empty.')
    if (f.size > MAX_BYTES) return refuse('That file is too large.', `The limit is ${fmtSize(MAX_BYTES)}. Split it into smaller files.`)
    setFile(f)
    setBatch(null)
    forget(ACTIVE_KEY)
  }

  function onPick(e) {
    accept(e.target.files)
    e.target.value = ''                 // so choosing the same file again still fires
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    accept(e.dataTransfer?.files)
  }

  function reset() {
    setFile(null)
    setError(null)
    setBatch(null)
    setPollError(null)
    setOpenRow(null)
    setStopping(false)
    forget(ACTIVE_KEY)
  }

  async function run() {
    if (!file || running) return
    setUploading(true)
    setError(null)
    setPollError(null)
    setStopping(false)
    try {
      const started = await startBatch(file, { threshold, monitor })
      remember(ACTIVE_KEY, started.id)
      setBatch(started)
      if (started.status !== 'running') finished(started)     // a very small file can be done before the reply
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
    }
  }

  async function cancel() {
    if (!batch || stopping) return
    setStopping(true)
    try {
      setBatch(await cancelBatch(batch.id))
    } catch (err) {
      setStopping(false)
      setPollError(err)
    }
  }

  const kind = file ? KINDS[extOf(file.name)] : null
  const thresholdLow = Number(threshold) < 75
  const finishedBatch = batch && batch.status !== 'running'

  return (
    <div className="workspace">
      <section className="sheet intake" aria-labelledby="batch-heading">
        <div className="folder-tab">Batch screening</div>
        <h1 id="batch-heading">Screen a file of applicants</h1>

        <div className="form">
          <div className="field">
            <span className="field-label" id="batch-file-label">Applicant file</span>
            <div
              className={`dropzone${dragging ? ' dropzone-drag' : ''}${file ? ' dropzone-has' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                id="batch-file"
                type="file"
                accept={ACCEPT}
                className="visually-hidden"
                onChange={onPick}
                disabled={running}
                aria-labelledby="batch-file-label"
                aria-describedby="batch-file-hint"
              />
              {!file ? (
                <label htmlFor="batch-file" className="dropzone-label">
                  <span className="dropzone-icon"><UploadIcon /></span>
                  <span className="dropzone-title">Drop an Excel or Word file here</span>
                  <span className="dropzone-or">or <span className="dropzone-browse">browse your files</span></span>
                </label>
              ) : (
                <div className="file-card">
                  <span className={`file-badge file-badge-${kind.toLowerCase()}`} aria-hidden="true">{extOf(file.name).toUpperCase()}</span>
                  <div className="file-meta">
                    <p className="file-name" title={file.name}>{file.name}</p>
                    <p className="file-sub">{kind} file, {fmtSize(file.size)}</p>
                  </div>
                  <div className="file-actions">
                    <button type="button" className="btn btn-quiet btn-small" disabled={running} onClick={() => inputRef.current?.click()}>Replace</button>
                    <button type="button" className="btn btn-quiet btn-small" disabled={running} onClick={reset} aria-label={`Remove ${file.name}`}>Remove</button>
                  </div>
                </div>
              )}
            </div>
            <span id="batch-file-hint" className="field-hint">
              Excel (.xlsx, .xls), CSV or Word (.docx), up to {fmtSize(MAX_BYTES)}. The first row holds the column names.{' '}
              <button type="button" className="inline-link-btn batch-hint-link" onClick={downloadTemplate}>Download a template</button>
            </span>
          </div>

          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          <div className="field">
            <label className="field-label" htmlFor="batch-threshold">
              Match threshold <output htmlFor="batch-threshold" className="threshold-value">{threshold}%</output>
            </label>
            <input
              id="batch-threshold"
              type="range"
              min="50"
              max="100"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ '--fill': `${((Number(threshold) - 50) / 50) * 100}%` }}
              aria-describedby="batch-threshold-hint"
              disabled={running}
            />
            <span id="batch-threshold-hint" className="field-hint">
              {thresholdLow
                ? 'Low threshold: catches more spelling variants, with many more false matches to review.'
                : 'Applies to every row. 85 is the standard setting.'}
            </span>
          </div>

          <label className="check-row" htmlFor="batch-monitor">
            <input id="batch-monitor" type="checkbox" checked={monitor} disabled={running} onChange={(e) => setMonitor(e.target.checked)} />
            <span>
              <span className="field-label">Keep monitoring everyone in this file</span>
              <span className="field-hint">
                Screen each person again automatically whenever a sanctions list changes, and be told about any new match.
                Only you will see the alerts.
              </span>
            </span>
          </label>

          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={!file || running} onClick={run}>
              {running ? 'Screening...' : 'Run batch screening'}
            </button>
            <button type="button" className="btn btn-quiet" disabled={running || (!file && !batch)} onClick={reset}>Clear</button>
          </div>
        </div>

        <p className="consent-notice">
          Only use this for applicants who have already consented to KYC/AML screening. Every name in the file is also
          sent to a news search. See the data handling notice in the footer.
        </p>
      </section>

      <div className="outcome" aria-live="polite">
        {pollError && <ErrorBanner error={pollError} onDismiss={() => setPollError(null)} />}
        {!running && !finishedBatch && <Guide />}
        {running && <Progress batch={batch} reading={uploading} stopping={stopping} onCancel={cancel} />}
        {finishedBatch && openRow && <CaseView row={openRow} onBack={() => setOpenRow(null)} />}
        {finishedBatch && (
          <div hidden={!!openRow}>
            <Results batch={batch} onNew={reset} onOpen={setOpenRow} />
          </div>
        )}
      </div>
    </div>
  )
}
