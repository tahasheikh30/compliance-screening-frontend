import { useState } from 'react'
import { reviewApplicant } from '../api'
import ErrorBanner from './ErrorBanner'
import { useToast } from './Toaster'
import { fmtDateTime } from '../lib/format'

export const DECISIONS = [
  { id: 'cleared', label: 'Cleared', hint: 'A false alarm: not the listed person.' },
  { id: 'confirmed', label: 'Confirmed match', hint: 'The same person as the listed one.' },
  { id: 'escalated', label: 'Escalated', hint: 'Passed to compliance or a senior reviewer.' },
]

export function decisionLabel(id) {
  return DECISIONS.find((d) => d.id === id)?.label || ''
}

/**
 * What a person concluded about a screening. It records the decision and a note (and who and when, on the server);
 * it does not change the screening result itself.
 */
export default function ReviewPanel({ applicantId, decision: initial, note: initialNote, reviewedAt, onChange }) {
  const toast = useToast()
  const [decision, setDecision] = useState(initial || null)
  const [note, setNote] = useState(initialNote || '')
  const [at, setAt] = useState(reviewedAt || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [savedNote, setSavedNote] = useState((initialNote || '').trim())
  const [picked, setPicked] = useState(initial || null)   // the choice being made, saved with the button

  async function save(next) {
    setBusy(true)
    setError(null)
    try {
      const out = await reviewApplicant(applicantId, next, next ? note.trim() : '')
      setDecision(out.review_decision)
      setPicked(out.review_decision)
      setAt(out.reviewed_at)
      setSavedNote(out.review_note || '')
      if (!out.review_decision) setNote('')
      onChange?.(out.review_decision)
      toast.success(next ? 'Decision saved' : 'Decision removed', { log: false })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const changed = !!picked && (picked !== decision || note.trim() !== savedNote)
  return (
    <div className="review-panel">
      <p className="monitor-toggle-title">Your decision</p>
      <p className="field-hint">
        {decision
          ? `${decisionLabel(decision)}${at ? `, saved ${fmtDateTime(at)}` : ''}.`
          : 'Not reviewed yet. Record what you concluded so the next person knows.'}
      </p>
      <div className="filter-group" role="group" aria-label="Decision">
        {DECISIONS.map((d) => (
          <button key={d.id} type="button" title={d.hint} aria-pressed={picked === d.id}
            className={`filter-btn ${picked === d.id ? 'filter-btn-on' : ''}`} onClick={() => setPicked(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <label className="field" htmlFor={`review-note-${applicantId}`}>
        <span className="field-label">Note (optional)</span>
        <textarea id={`review-note-${applicantId}`} rows={2} maxLength={1000} value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="Why, for example: different date of birth and father's name." />
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-small" disabled={busy || !changed}
          onClick={() => save(picked)}>
          {busy ? 'Saving...' : 'Save decision'}
        </button>
        {decision && (
          <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => save(null)}>Remove decision</button>
        )}
      </div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
    </div>
  )
}
