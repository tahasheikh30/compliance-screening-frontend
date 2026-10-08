import { useEffect, useRef, useState } from 'react'
import { screenApplicant } from '../../api'
import ErrorBanner, { fieldError } from '../../components/ErrorBanner'
import CaseReport from '../../components/CaseReport'
import MonitorToggle from '../../components/MonitorToggle'
import { MagnifyingGlassIcon, ScanningAnimation } from '../../components/ui'
import { SOURCES, SOURCE_ORDER, overallInfo } from '../../lib/status'
import { useToast } from '../../components/Toaster'
import BatchScreening from './BatchScreening'

const DEFAULT_THRESHOLD = 85

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function EmptyState() {
  return (
    <div className="empty">
      <h2>What gets checked</h2>
      <ul className="empty-sources">
        {SOURCE_ORDER.map((k) => (
          <li key={k}>
            <span className="empty-source-name">{SOURCES[k].name}</span>
            <span className="empty-source-long">{SOURCES[k].long}</span>
          </li>
        ))}
      </ul>
      <p>
        Every list is downloaded live from its publisher, so a result reflects the lists as they are today. A
        source that cannot be reached is reported as not screened. It never counts as clear.
      </p>
    </div>
  )
}

function IndividualScreening() {
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [nationality, setNationality] = useState('')
  const [cnic, setCnic] = useState('')
  const [cnicTouched, setCnicTouched] = useState(false)
  const [fatherName, setFatherName] = useState('')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [monitor, setMonitor] = useState(false)       // keep watching this person after the screening
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [caseData, setCaseData] = useState(null)
  const [submitted, setSubmitted] = useState(null) // what the report was run with
  const headingRef = useRef(null)
  const reportKey = useRef(0)

  // Move focus to the verdict when a result arrives, so keyboard and screen
  // reader users land on it instead of having to hunt for it.
  useEffect(() => {
    if (caseData) headingRef.current?.focus({ preventScroll: false })
  }, [caseData])

  // A CNIC has 13 digits. Dashes and spaces are fine; anything else is rejected here
  // rather than silently ignored by the server.
  const cnicDigits = cnic.replace(/\D/g, '')
  const cnicInvalid = !!cnic.trim() && cnicDigits.length !== 13
  // only complain once they have left the field (or typed too many digits), not mid-typing
  const cnicProblem = cnicInvalid && (cnicTouched || cnicDigits.length > 13) ? 'A CNIC has 13 digits (dashes are optional).' : null

  async function doSubmit() {
    const run = { full_name: fullName.trim(), dob, nationality: nationality.trim(), threshold,
      cnic: cnicDigits, father_name: fatherName.trim(), monitor }
    setLoading(true)
    setError(null)
    setCaseData(null)
    try {
      const data = await screenApplicant(run)
      reportKey.current += 1
      setSubmitted({ dob: run.dob, nationality: run.nationality })
      setCaseData(data)
      // also reaches the person if they moved to another tab while the 20 to 40 seconds went by
      const info = overallInfo(data.overall_status)
      const kind = { bad: 'error', warn: 'warn', good: 'success' }[info.tone] || 'info'
      toast[kind](`Screening complete: ${info.stamp}`, {
        message: `${data.full_name}. ${info.headline}.${data.monitored ? ' Now under continuous monitoring.' : ''}`, to: 'history',
      })
    } catch (err) {
      setError(err)
      toast.error('Screening did not finish', { message: err?.message || 'Please try again.', to: 'history' })
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!fullName.trim() || loading) return
    if (cnicInvalid) { setCnicTouched(true); return }
    doSubmit()
  }

  function clearForm() {
    setFullName('')
    setDob('')
    setNationality('')
    setCnic('')
    setCnicTouched(false)
    setFatherName('')
    setThreshold(DEFAULT_THRESHOLD)
    setMonitor(false)
    setError(null)
    setCaseData(null)
  }

  const nameError = fieldError(error, 'full_name')
  const dobError = fieldError(error, 'dob')
  const thresholdLow = Number(threshold) < 75

  return (
    <div className="workspace">
      <section className="sheet intake" aria-labelledby="intake-heading">
        <div className="folder-tab">New screening</div>
        <h1 id="intake-heading"><MagnifyingGlassIcon size={22} /> Screen an applicant</h1>

        <form onSubmit={handleSubmit} className="form" noValidate>
          <label className="field" htmlFor="full-name-input">
            <span className="field-label">Full name</span>
            <input
              id="full-name-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Muhammad Ahmed Khan"
              autoComplete="off"
              required
              aria-required="true"
              aria-invalid={!!nameError}
              aria-describedby="name-hint"
            />
            <span id="name-hint" className="field-hint">As written on the ID. Word order and titles such as Dr or Haji do not matter.</span>
            {nameError && <span className="field-error">{nameError}</span>}
          </label>

          <div className="field-row">
            <label className="field" htmlFor="dob-input">
              <span className="field-label">Date of birth</span>
              <input
                id="dob-input"
                type="date"
                value={dob}
                max={todayIso()}
                onChange={(e) => setDob(e.target.value)}
                aria-invalid={!!dobError}
              />
              {dobError && <span className="field-error">{dobError}</span>}
            </label>
            <label className="field" htmlFor="nationality-input">
              <span className="field-label">Nationality</span>
              <input
                id="nationality-input"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="e.g. Pakistan"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="field-row field-row-cnic">
            <label className="field" htmlFor="cnic-input">
              <span className="field-label">CNIC</span>
              <input
                id="cnic-input"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                onBlur={() => setCnicTouched(true)}
                placeholder="35202-1234567-1"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={!!cnicProblem}
                aria-describedby="cnic-hint"
              />
              {cnicProblem && <span className="field-error">{cnicProblem}</span>}
            </label>
            <label className="field" htmlFor="father-input">
              <span className="field-label">Father or husband</span>
              <input
                id="father-input"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                placeholder="Name"
                autoComplete="off"
              />
            </label>
          </div>
          <p id="cnic-hint" className="field-hint field-hint-block">
            All of these except the name are optional. A CNIC that equals a CNIC on the NACTA or FIA Red Book lists
            is reported as a match whatever the name looks like, so enter it whenever you have it. The others are
            shown next to each match as supporting evidence and never remove one.
          </p>

          <div className="field">
            <label className="field-label" htmlFor="threshold-input">
              Match threshold <output htmlFor="threshold-input" className="threshold-value">{threshold}%</output>
            </label>
            <input
              id="threshold-input"
              type="range"
              min="50"
              max="100"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ '--fill': `${((Number(threshold) - 50) / 50) * 100}%` }}
              aria-describedby="threshold-hint"
            />
            <span id="threshold-hint" className="field-hint">
              {thresholdLow
                ? 'Low threshold: catches more spelling variants, with many more false matches to review.'
                : 'Names scoring at or above this are reported. 85 is the standard setting.'}
            </span>
          </div>

          <label className="check-row" htmlFor="monitor-input">
            <input id="monitor-input" type="checkbox" checked={monitor} onChange={(e) => setMonitor(e.target.checked)} />
            <span>
              <span className="field-label">Keep monitoring this person</span>
              <span className="field-hint">
                Screen them again automatically whenever a sanctions list changes, and be told about any new match.
                Only you will see the alerts.
              </span>
            </span>
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading || !fullName.trim() || cnicInvalid}>
              {loading ? 'Screening...' : 'Run screening'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={clearForm} disabled={loading}>Clear</button>
          </div>
        </form>

        <p className="consent-notice">
          Only use this for applicants who have already consented to KYC/AML screening. The name is also sent
          to a news search. See the data handling notice in the footer.
        </p>
      </section>

      <div className="outcome" aria-live="polite">
        <ErrorBanner error={error} onRetry={doSubmit} onDismiss={() => setError(null)} />
        {loading && <ScanningAnimation />}
        {!loading && caseData && (
          <>
            <CaseReport key={reportKey.current} ref={headingRef} caseData={caseData} applicant={submitted} />
            <MonitorToggle key={`monitor-${reportKey.current}`} applicantId={caseData.applicant_id} monitored={!!caseData.monitored} />
          </>
        )}
        {!loading && !caseData && !error && <EmptyState />}
      </div>
    </div>
  )
}

const MODES = [
  {
    id: 'individual', label: 'Individual', sub: 'One applicant',
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" /></>,
  },
  {
    id: 'batch', label: 'Batch', sub: 'Upload a file',
    icon: <><rect x="7" y="3" width="13" height="16" rx="2" /><path d="M4 7v12a2 2 0 0 0 2 2h10" /><path d="M11 8h5M11 12h5" /></>,
  },
]

/** Individual or batch. Each side keeps its own state while the other is showing. */
export default function ScreeningTab() {
  const [mode, setMode] = useState('individual')
  const [batchSeen, setBatchSeen] = useState(false)

  function choose(id) {
    setMode(id)
    if (id === 'batch') setBatchSeen(true)
  }

  // arrow keys move between the two, as in any tab list
  function onKeyDown(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const i = MODES.findIndex((m) => m.id === mode)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? MODES.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + MODES.length) % MODES.length
    choose(MODES[next].id)
    document.getElementById(`mode-tab-${MODES[next].id}`)?.focus()
  }

  return (
    <div className="screening">
      <div className="mode-switch" role="tablist" aria-label="Screening type" onKeyDown={onKeyDown}>
        {MODES.map((m) => {
          const on = mode === m.id
          return (
            <button
              key={m.id}
              id={`mode-tab-${m.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`mode-panel-${m.id}`}
              tabIndex={on ? 0 : -1}
              className={`mode-btn${on ? ' mode-btn-on' : ''}`}
              onClick={() => choose(m.id)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{m.icon}</svg>
              <span className="mode-text">
                <span className="mode-title">{m.label}</span>
                <span className="mode-sub">{m.sub}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" id="mode-panel-individual" aria-labelledby="mode-tab-individual" hidden={mode !== 'individual'}>
        <IndividualScreening />
      </div>
      {batchSeen && (
        <div role="tabpanel" id="mode-panel-batch" aria-labelledby="mode-tab-batch" hidden={mode !== 'batch'}>
          <BatchScreening />
        </div>
      )}
    </div>
  )
}
