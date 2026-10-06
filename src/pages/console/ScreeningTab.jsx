import { useEffect, useRef, useState } from 'react'
import { screenApplicant } from '../../api'
import ErrorBanner, { fieldError } from '../../components/ErrorBanner'
import CaseReport from '../../components/CaseReport'
import { MagnifyingGlassIcon, ScanningAnimation } from '../../components/ui'
import { SOURCES, SOURCE_ORDER } from '../../lib/status'

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

export default function ScreeningTab() {
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [nationality, setNationality] = useState('')
  const [cnic, setCnic] = useState('')
  const [cnicTouched, setCnicTouched] = useState(false)
  const [fatherName, setFatherName] = useState('')
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
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
      cnic: cnicDigits, father_name: fatherName.trim() }
    setLoading(true)
    setError(null)
    setCaseData(null)
    try {
      const data = await screenApplicant(run)
      reportKey.current += 1
      setSubmitted({ dob: run.dob, nationality: run.nationality })
      setCaseData(data)
    } catch (err) {
      setError(err)
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
              aria-describedby="threshold-hint"
            />
            <span id="threshold-hint" className="field-hint">
              {thresholdLow
                ? 'Low threshold: catches more spelling variants, with many more false matches to review.'
                : 'Names scoring at or above this are reported. 85 is the standard setting.'}
            </span>
          </div>

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
          <CaseReport key={reportKey.current} ref={headingRef} caseData={caseData} applicant={submitted} />
        )}
        {!loading && !caseData && !error && <EmptyState />}
      </div>
    </div>
  )
}
