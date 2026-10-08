import { useEffect, useMemo, useRef, useState } from 'react'
import ErrorBanner from '../../components/ErrorBanner'
import { useToast } from '../../components/Toaster'
import { Pill } from '../../components/ui'
import { ApiError } from '../../lib/apiError'
import { fmtNum } from '../../lib/format'
import { overallInfo, SOURCE_ORDER } from '../../lib/status'
import { simulateBatch } from './batchDemo'

const DEFAULT_THRESHOLD = 85
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
]

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

function PreviewNote({ children }) {
  return (
    <p className="preview-note" role="note">
      <strong>Design preview.</strong> {children}
    </p>
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

function Progress({ done, total, onCancel }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="scan batch-progress" role="status" aria-live="polite">
      <p className="scan-title">Screening the file</p>
      <p className="scan-sub">
        Row <span className="scan-clock">{done}</span> of <span className="scan-clock">{total}</span>. Each row is checked against every list.
      </p>
      <div className="bar" role="progressbar" aria-label="Batch progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <span className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <button type="button" className="btn btn-quiet btn-small" onClick={onCancel}>Cancel</button>
    </div>
  )
}

function Results({ rows, file, onNew }) {
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const count = (id) => rows.filter((r) => r.overall_status === id).length
  const shown = useMemo(() => rows.filter((r) => filter === 'all' || r.overall_status === filter), [rows, filter])
  const notYet = (what) => toast.info(`${what} is not connected yet`, { message: 'It will work once the batch backend is wired.', log: false })

  return (
    <section className="report batch-report" aria-labelledby="batch-report-heading">
      <header className="verdict verdict-warn">
        <div className="verdict-text">
          <p className="verdict-ref"><span className="mono">{file.name}</span></p>
          <h2 id="batch-report-heading" tabIndex={-1}>Batch screened</h2>
          <p className="verdict-applicant">{fmtNum(rows.length)} rows<span className="verdict-sub">{count('ESCALATE_TO_COMPLIANCE')} need escalating</span></p>
        </div>
      </header>

      <PreviewNote>These results are simulated so the layout can be reviewed. No file was read and nothing was screened.</PreviewNote>

      <dl className="tally">
        <div><dt>Rows screened</dt><dd>{fmtNum(rows.length)}</dd></div>
        <div><dt>Escalate</dt><dd className={count('ESCALATE_TO_COMPLIANCE') ? 'tally-bad' : ''}>{count('ESCALATE_TO_COMPLIANCE')}</dd></div>
        <div><dt>Review</dt><dd className={count('MANUAL_REVIEW') ? 'tally-warn' : ''}>{count('MANUAL_REVIEW')}</dd></div>
        <div><dt>Clear</dt><dd>{count('AUTO_CLEAR')}</dd></div>
      </dl>

      <div className="batch-toolbar">
        <div className="filter-group" role="group" aria-label="Filter by outcome">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`filter-btn ${filter === f.id ? 'filter-btn-on' : ''}`}
              aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}{f.id !== 'all' && <span className="filter-count"> {count(f.id)}</span>}
            </button>
          ))}
        </div>
        <div className="batch-downloads">
          <button type="button" className="btn btn-primary btn-small" onClick={() => notYet('The results download')}>Download results (.xlsx)</button>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => notYet('The evidence download')}>Evidence (.zip)</button>
        </div>
      </div>

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
              const info = overallInfo(r.overall_status)
              return (
                <tr key={r.row}>
                  <td className="num mono">{r.row}</td>
                  <td><span className="batch-name">{r.full_name}</span></td>
                  <td><Pill tone={info.tone}>{info.stamp}</Pill></td>
                  <td className="num">{r.sanctions}</td>
                  <td className="num">{r.news}</td>
                  <td className="num">
                    <button type="button" className="row-btn batch-open" onClick={() => notYet('Opening a case')}>View case</button>
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

export default function BatchScreening() {
  const toast = useToast()
  const inputRef = useRef(null)
  const stop = useRef(null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [phase, setPhase] = useState('idle')            // 'idle' | 'running' | 'done'
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [rows, setRows] = useState([])

  useEffect(() => () => stop.current?.(), [])

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
    setPhase('idle')
    setRows([])
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

  function clearFile() {
    setFile(null)
    setError(null)
    setPhase('idle')
    setRows([])
  }

  function run() {
    if (!file || phase === 'running') return
    setPhase('running')
    setError(null)
    // DESIGN PREVIEW: swap this call for the real batch request when the backend is ready.
    stop.current = simulateBatch({
      onProgress: setProgress,
      onDone: (result) => {
        setRows(result)
        setPhase('done')
        toast.success('Batch preview finished', { message: 'Simulated results, nothing was screened.', log: false })
      },
    })
  }

  function cancel() {
    stop.current?.()
    setPhase('idle')
  }

  const kind = file ? KINDS[extOf(file.name)] : null
  const thresholdLow = Number(threshold) < 75
  const running = phase === 'running'

  return (
    <div className="workspace">
      <section className="sheet intake" aria-labelledby="batch-heading">
        <div className="folder-tab">Batch screening</div>
        <h1 id="batch-heading">Screen a file of applicants</h1>

        <PreviewNote>The batch backend is not connected yet, so Run shows simulated results.</PreviewNote>

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
                    <button type="button" className="btn btn-quiet btn-small" disabled={running} onClick={clearFile} aria-label={`Remove ${file.name}`}>Remove</button>
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

          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={!file || running} onClick={run}>
              {running ? 'Screening...' : 'Run batch screening'}
            </button>
            <button type="button" className="btn btn-quiet" disabled={running || (!file && phase === 'idle')} onClick={clearFile}>Clear</button>
          </div>
        </div>

        <p className="consent-notice">
          Only use this for applicants who have already consented to KYC/AML screening. Every name in the file is also
          sent to a news search. See the data handling notice in the footer.
        </p>
      </section>

      <div className="outcome" aria-live="polite">
        {phase === 'idle' && <Guide />}
        {phase === 'running' && <Progress done={progress.done} total={progress.total} onCancel={cancel} />}
        {phase === 'done' && file && <Results rows={rows} file={file} onNew={clearFile} />}
      </div>
    </div>
  )
}
