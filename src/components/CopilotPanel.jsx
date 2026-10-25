import { useState } from 'react'
import { askCopilot } from '../api'
import ErrorBanner from './ErrorBanner'
import { Pill } from './ui'
import { aiHas, useAiStatus } from '../lib/ai'
import { fmtDate } from '../lib/format'
import { overallInfo } from '../lib/status'

const OUTCOMES = [
  ['', 'Any outcome'], ['ESCALATE_TO_COMPLIANCE', 'Escalated'], ['MANUAL_REVIEW', 'Needs review'], ['AUTO_CLEAR', 'Clear'],
]

/**
 * Search your own screenings. The filter form always works. With AI search on you can also ask in words: the question is
 * turned into the same filters, shown back to you, and the answer comes from your own records.
 */
export default function CopilotPanel({ onOpen }) {
  const ai = useAiStatus()
  const canAsk = aiHas(ai, 'copilot')
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('')
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [answer, setAnswer] = useState(null)

  async function send(body) {
    setBusy(true); setError(null)
    try { setAnswer(await askCopilot(body)) } catch (e) { setError(e); setAnswer(null) } finally { setBusy(false) }
  }
  function ask(e) {
    e.preventDefault()
    if (question.trim()) send({ question: question.trim() })
  }
  function filter(e) {
    e.preventDefault()
    const filters = {}
    if (status) filters.overall_status = [status]
    if (name.trim()) filters.name_contains = name.trim()
    if (from) filters.date_from = from
    if (to) filters.date_to = to
    send({ filters })
  }

  return (
    <details className="copilot">
      <summary>
        <span className="copilot-title">Search your screenings</span>
        <span className="field-hint">{canAsk ? 'Ask a question or filter' : 'Filter by outcome, name and date'}</span>
      </summary>
      {canAsk ? (
        <form onSubmit={ask} className="copilot-ask">
          <label className="field" htmlFor="copilot-q">
            <span className="field-label">Ask a question</span>
            <input id="copilot-q" value={question} maxLength={400} onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which Punjab PEP cases did I escalate last month?" />
          </label>
          <button type="submit" className="btn btn-primary btn-small" disabled={busy || !question.trim()}>{busy ? 'Searching...' : 'Ask'}</button>
        </form>
      ) : (
        <p className="field-hint">AI search is off, so questions in words are not available. The filters below work as usual.</p>
      )}
      <form onSubmit={filter} className="copilot-filters">
        <label className="field"><span className="field-label">Outcome</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className="field"><span className="field-label">Name contains</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span className="field-label">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span className="field-label">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="submit" className="btn btn-quiet btn-small" disabled={busy}>Filter</button>
      </form>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {answer && (
        <div className="copilot-answer" aria-live="polite">
          <p><strong>{answer.summary}</strong></p>
          <p className="field-hint">Searched: {answer.described}.{answer.explanation ? ` ${answer.explanation}` : ''}</p>
          {answer.rows.length > 0 && (
            <ul className="copilot-rows">
              {answer.rows.map((r) => {
                const info = overallInfo(r.overall_status)
                return (
                  <li key={r.id}>
                    <span className="mono">{r.case_ref}</span>{' '}
                    {onOpen ? <button type="button" className="inline-link-btn" onClick={() => onOpen(r)}>{r.full_name}</button> : r.full_name}{' '}
                    <Pill tone={info.tone}>{info.stamp}</Pill>
                    <span className="field-hint"> {fmtDate(r.submitted_at)}{r.review_decision ? `, you: ${r.review_decision}` : ''}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </details>
  )
}
