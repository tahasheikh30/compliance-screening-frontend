import { useState, useEffect } from 'react'
import { screenApplicant, listApplicants, downloadEvidence } from './api'

const SOURCE_LABELS = {
  UNSC: 'UN Security Council Sanctions List',
  FIA_REDBOOK: "FIA Red Book (Pakistan)",
  ADVERSE_MEDIA: 'Adverse Media',
}

const STATUS_STYLE = {
  HIT: { color: 'var(--stamp-red)', label: 'HIT' },
  REVIEW: { color: 'var(--stamp-amber)', label: 'REVIEW' },
  CLEAR: { color: 'var(--stamp-green)', label: 'CLEAR' },
  ERROR: { color: 'var(--stamp-amber)', label: 'ERROR' },
  NOT_CONFIGURED: { color: 'var(--stamp-amber)', label: 'NOT CHECKED' },
  SKIPPED: { color: 'var(--stamp-amber)', label: 'SKIPPED' },
}

function todayStr() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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
          >
            Download proof (PDF)
          </button>
        )}
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
        setError('Server has no API_KEY configured — contact whoever deployed this.')
        setChecking(false)
        return
      }
      sessionStorage.setItem('screening_api_key', value.trim())
      onUnlock()
    } catch (err) {
      setError('Could not reach the backend — check the API URL is configured correctly.')
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
          <label className="field">
            <span>Access key</span>
            <input
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
        {error && <div className="error-note">{error}</div>}
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
    <div className="page">
      <div className="folder">
        <div className="folder-tab">Case File</div>

        <header className="folder-header">
          <h1>Account-Opening Screening</h1>
          <p className="folder-meta">Opened {todayStr()}{caseNumber && <> &nbsp;&middot;&nbsp; Ref. {caseNumber}</>}</p>
        </header>

        <form onSubmit={handleSubmit} className="intake-form">
          <label className="field">
            <span>Applicant full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Muhammad Ahmed Khan"
              required
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>CNIC</span>
              <input
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                placeholder="XXXXX-XXXXXXX-X"
              />
            </label>
            <label className="field">
              <span>Father's / husband's name</span>
              <input
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

        {error && <div className="error-note">{error}</div>}

        {caseData && (
          <section className="results">
            <div className="results-heading">
              <h2>Findings</h2>
              <span
                className="overall-tag"
                style={{ color: caseData.overall_status === 'ESCALATE_TO_COMPLIANCE' ? 'var(--stamp-red)'
                  : caseData.overall_status === 'MANUAL_REVIEW' ? 'var(--stamp-amber)' : 'var(--stamp-green)' }}
              >
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
                <span
                  className="history-status"
                  style={{ color: h.overall_status === 'ESCALATE_TO_COMPLIANCE' ? 'var(--stamp-red)'
                    : h.overall_status === 'MANUAL_REVIEW' ? 'var(--stamp-amber)' : 'var(--stamp-green)' }}
                >
                  {h.overall_status.replace(/_/g, ' ').toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}
