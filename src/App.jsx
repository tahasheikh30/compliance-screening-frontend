import { useState, useEffect } from 'react'
import { screenApplicant, listApplicants, downloadEvidence } from './api'

const SOURCE_LABELS = {
  UNSC: 'UN Security Council Sanctions List',
  FIA_REDBOOK: "FIA Red Book (Pakistan)",
  ADVERSE_MEDIA: 'Adverse Media',
}

// Colors tuned for the light "paper" background - do not reuse these for
// text on the dark page background (see the *_DARK variants below).
const STATUS_STYLE = {
  HIT: { color: 'var(--stamp-red)', label: 'HIT' },
  REVIEW: { color: 'var(--stamp-amber)', label: 'REVIEW' },
  CLEAR: { color: 'var(--stamp-green)', label: 'CLEAR' },
  ERROR: { color: 'var(--stamp-amber)', label: 'ERROR' },
  NOT_CONFIGURED: { color: 'var(--stamp-amber)', label: 'NOT CHECKED' },
  SKIPPED: { color: 'var(--stamp-amber)', label: 'SKIPPED' },
}

function overallColor(status, dark = false) {
  const suffix = dark ? '-dark' : ''
  if (status === 'ESCALATE_TO_COMPLIANCE') return `var(--stamp-red${suffix})`
  if (status === 'MANUAL_REVIEW') return `var(--stamp-amber${suffix})`
  return `var(--stamp-green${suffix})`
}

function todayStr() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function MagnifyingGlassIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
      <line x1="15.1" y1="15.1" x2="20.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ScanningAnimation() {
  const pages = [15, 115, 215, 315]
  return (
    <div className="scan-scene-wrap" role="status" aria-live="polite">
      <svg className="scan-scene" viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {pages.map((x, i) => (
          <g key={x}>
            <rect
              className="scan-page-rect"
              data-page={i + 1}
              x={x} y="25" width="70" height="90" rx="4"
            />
            <rect className="scan-page-line" x={x + 12} y="45" width="46" height="4" rx="2" />
            <rect className="scan-page-line" x={x + 12} y="58" width="46" height="4" rx="2" />
            <rect className="scan-page-line" x={x + 12} y="71" width="32" height="4" rx="2" />
          </g>
        ))}
        <g className="scan-glass-group">
          <circle className="scan-glass-ring" cx="0" cy="0" r="24" />
          <line className="scan-glass-handle" x1="17" y1="17" x2="33" y2="33" />
        </g>
      </svg>
      <span className="scan-status-text">Checking records…</span>
    </div>
  )
}

function Stamp({ status }) {
  const s = STATUS_STYLE[status] || { color: 'var(--stamp-amber)', label: status || 'UNKNOWN' }
  return (
    <span className="stamp" style={{ color: s.color, borderColor: s.color }}>
      {s.label}
    </span>
  )
}

function ResultRow({ result }) {
  return (
    <div className="result-row">
      <div className="result-main">
        <div className="result-source">{SOURCE_LABELS[result.source] || result.source}</div>
        <div className="result-detail">
          {result.matched_entry
            ? <>Closest match: <strong>{result.matched_entry}</strong>{result.score != null && <> &mdash; confidence {Math.round(result.score)}/100</>}</>
            : <>No matching record found.</>}
        </div>
        {result.detail && <div className="result-note">{result.detail}</div>}
      </div>
      <div className="result-side">
        <Stamp status={result.status} />
        {result.evidence_file && (
          <button
            type="button"
            className="evidence-link"
            onClick={() => downloadEvidence(result.id, result.evidence_file)}
            aria-label={`Download evidence PDF for ${SOURCE_LABELS[result.source] || result.source} result`}
          >
            Download proof (PDF)
          </button>
        )}
      </div>
    </div>
  )
}

function DataNoticeModal({ onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="policy-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-notice-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="policy-modal">
        <h2 id="data-notice-title">Data handling notice</h2>
        <p>Internal reference for staff using this tool - not a public-facing legal document.</p>

        <h3>What this tool collects</h3>
        <p>
          Only what's needed to run a name-based screening check: the
          applicant's full name, and optionally a CNIC and father's/husband's
          name to reduce false matches. No other applicant details are
          collected here.
        </p>

        <h3>What it's used for</h3>
        <p>
          Submitted names are checked against the UN Security Council
          sanctions list, an uploaded FIA Red Book edition, and (if
          configured) an adverse-media source, solely for account-opening
          AML/KYC screening. Results and any generated evidence PDF are
          stored so a compliance officer can review the finding later.
        </p>

        <h3>Consent</h3>
        <p>
          This tool assumes the applicant has already been informed and has
          consented to KYC/AML screening as part of your organization's
          standard account-opening process. Do not enter data for anyone
          outside that process.
        </p>

        <h3>Legal context</h3>
        <p>
          Pakistan does not yet have a comprehensive enacted data protection
          law - the Personal Data Protection Bill remains in draft. The
          Prevention of Electronic Crimes Act 2016, along with SBP/SECP
          sector regulations, currently govern relevant data handling
          obligations. Confirm specific retention, storage, and disclosure
          requirements with your compliance/legal team rather than relying
          on this notice alone.
        </p>

        <button type="button" className="submit-btn close-btn" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </div>
  )
}

function AccessGate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim()) return
    setChecking(true)
    setError(null)
    try {
      // Verify the key actually works before storing it, by hitting a cheap endpoint.
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/applicants`, {
        headers: { 'X-API-Key': value.trim() },
      })
      if (res.status === 401) {
        setError('That key was rejected.')
        setChecking(false)
        return
      }
      if (res.status === 503) {
        setError('Server has no API_KEY configured - contact whoever deployed this.')
        setChecking(false)
        return
      }
      sessionStorage.setItem('screening_api_key', value.trim())
      onUnlock()
    } catch (err) {
      setError('Could not reach the backend - check the API URL is configured correctly.')
      setChecking(false)
    }
  }

  return (
    <div className="page">
      <div className="folder gate-folder">
        <div className="folder-tab">Case File</div>
        <header className="folder-header">
          <h1>Restricted Access</h1>
          <p className="folder-meta">Enter the access key to open the screening console</p>
        </header>
        <form onSubmit={handleSubmit} className="intake-form">
          <label className="field" htmlFor="access-key-input">
            <span>Access key</span>
            <input
              id="access-key-input"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
            />
          </label>
          <button type="submit" className="submit-btn" disabled={checking}>
            {checking ? 'Checking…' : 'Unlock'}
          </button>
        </form>
        {error && <div className="error-note" role="alert" aria-live="polite">{error}</div>}
      </div>
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem('screening_api_key'))
  const [fullName, setFullName] = useState('')
  const [cnic, setCnic] = useState('')
  const [fatherName, setFatherName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [caseData, setCaseData] = useState(null)
  const [history, setHistory] = useState([])
  const [showDataNotice, setShowDataNotice] = useState(false)

  useEffect(() => {
    if (!unlocked) return
    listApplicants().then(setHistory).catch(() => {})
  }, [caseData, unlocked])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim()) return
    setLoading(true)
    setError(null)
    setCaseData(null)
    try {
      const data = await screenApplicant({ full_name: fullName, cnic, father_name: fatherName })
      setCaseData(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const caseNumber = caseData ? String(caseData.applicant_id).padStart(5, '0') : null

  if (!unlocked) {
    return <AccessGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <>
    <div className="page">
      <div className="folder">
        <div className="folder-tab">Case File</div>

        <header className="folder-header">
          <h1><MagnifyingGlassIcon size={22} /> Account-Opening Screening</h1>
          <p className="folder-meta">Opened {todayStr()}{caseNumber && <> &nbsp;&middot;&nbsp; Ref. {caseNumber}</>}</p>
        </header>

        <p className="consent-notice">
          Only the fields below are collected - full name is required; CNIC
          and father's/husband's name are optional and only help reduce
          false matches. Use this tool only for applicants who have already
          consented to KYC/AML screening as part of standard account-opening.{' '}
          <button
            type="button"
            className="inline-link-btn"
            onClick={() => setShowDataNotice(true)}
          >
            Read the full data handling notice
          </button>.
        </p>

        <form onSubmit={handleSubmit} className="intake-form">
          <label className="field" htmlFor="full-name-input">
            <span>Applicant full name</span>
            <input
              id="full-name-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Muhammad Ahmed Khan"
              required
              aria-required="true"
            />
          </label>
          <div className="field-row">
            <label className="field" htmlFor="cnic-input">
              <span>CNIC</span>
              <input
                id="cnic-input"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                placeholder="XXXXX-XXXXXXX-X"
              />
            </label>
            <label className="field" htmlFor="father-name-input">
              <span>Father's / husband's name</span>
              <input
                id="father-name-input"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Checking records…' : 'Run screening'}
          </button>
        </form>

        {error && <div className="error-note" role="alert" aria-live="polite">{error}</div>}

        {loading && <ScanningAnimation />}

        {caseData && (
          <section className="results" aria-live="polite">
            <div className="results-heading">
              <h2>Findings</h2>
              <span className="overall-tag" style={{ color: overallColor(caseData.overall_status) }}>
                {caseData.overall_status === 'ESCALATE_TO_COMPLIANCE' && 'Escalate to compliance'}
                {caseData.overall_status === 'MANUAL_REVIEW' && 'Needs manual review'}
                {caseData.overall_status === 'AUTO_CLEAR' && 'Cleared automatically'}
              </span>
            </div>
            <div className="results-list">
              {caseData.results.map((r) => <ResultRow key={r.id} result={r} />)}
            </div>
            <p className="disclaimer">
              Automated fuzzy-name matching only. No adverse action should be taken
              without a compliance officer confirming identity against the source record.
            </p>
          </section>
        )}
      </div>

      {history.length > 0 && (
        <aside className="history">
          <h3>Recent case files</h3>
          <ul>
            {history.map((h) => (
              <li key={h.id}>
                <span className="history-name">{h.full_name}</span>
                <span className="history-status" style={{ color: overallColor(h.overall_status, true) }}>
                  {h.overall_status.replace(/_/g, ' ').toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      )}
      </div>

      <footer className="site-footer">
        <span>Internal tool - IGI Securites, Compliance dept.</span>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => setShowDataNotice(true)}>Data handling notice</button>
      </footer>

      {showDataNotice && <DataNoticeModal onClose={() => setShowDataNotice(false)} />}
    </>
  )
}
