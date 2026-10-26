import { useRef, useState } from 'react'
import { askCopilot } from '../api'
import ErrorBanner from './ErrorBanner'
import { Pill } from './ui'
import { useToast } from './Toaster'
import { aiHas, useAiStatus } from '../lib/ai'
import { fmtDate } from '../lib/format'
import { overallInfo } from '../lib/status'

/**
 * What to tell the person when they search while AI search cannot answer, or null when it can.
 * `status` is the shared AI status ({ state, available, features }), or null while it is not known yet.
 */
export function aiUnavailableNotice(status) {
  if (!status) return null
  if (status.state === 'unconfigured') {
    return {
      title: 'AI search is not set up',
      message: 'No AI API key is configured on the server, so questions in words cannot be answered. Ask an administrator to add one. You can still search by name and use the filters.',
    }
  }
  if (status.state === 'paused') {
    return {
      title: 'AI search is resting',
      message: 'AI search is paused for now after repeated provider errors or because its daily limit was reached. Try again later, or search by name and use the filters.',
    }
  }
  if (!status.available) {
    return {
      title: 'AI search is turned off',
      message: 'An administrator has turned AI search off. You can still search by name and use the filters.',
    }
  }
  if (!aiHas(status, 'copilot')) {
    return {
      title: 'Asking questions is turned off',
      message: 'An administrator has switched off AI question search. You can still search by name and use the filters.',
    }
  }
  return null
}

// A few starting points under the bar. They only fill it in: nothing is sent until the person presses Ask.
const SUGGESTIONS = [
  'Cases I escalated last month',
  'Which cases are in manual review?',
  'Cases screened this week',
]

/**
 * The AI search bar across the top of the History tab. Ask in words ("Which Punjab PEP cases did I escalate last
 * month?"): the question is turned into filters, shown back so you can see how it was understood, and the answer
 * comes from your own records. The bar is always there. When AI search cannot answer (no key on the server, or an
 * administrator turned it off) searching says so with a notification instead of failing quietly.
 *
 *   onOpen   (row) => void   opens a case from the answer
 */
export default function AiSearchBar({ onOpen }) {
  const ai = useAiStatus()
  const toast = useToast()
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [answer, setAnswer] = useState(null)
  const [notice, setNotice] = useState(null)   // the "AI search is not available" message, also shown in the page
  const input = useRef(null)

  async function ask(e) {
    e.preventDefault()
    const text = question.trim()
    if (!text || busy) return
    setError(null)
    setAnswer(null)
    const unavailable = aiUnavailableNotice(ai)
    if (unavailable) {
      setNotice(unavailable)
      toast.warn(unavailable.title, { message: unavailable.message, essential: true })
      return
    }
    setNotice(null)
    setBusy(true)
    try {
      setAnswer(await askCopilot({ question: text }))
    } catch (err) {
      if (err?.code === 'NOT_UNDERSTOOD') {
        // not a failure: the question just did not map onto what can be searched. Say so calmly and point to what works.
        setNotice({
          title: 'That question could not be turned into a search',
          message: `${err.message || ''} Try naming an outcome, a decision or a time, such as "escalated last month", or use Filter on the list.`.trim(),
        })
      } else {
        setError(err)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ai-search" aria-label="AI search">
      <form onSubmit={ask} className="ai-search-bar" role="search">
        <svg className="ai-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" />
        </svg>
        <label htmlFor="ai-search-q" className="visually-hidden">Ask AI search about your screenings</label>
        <input
          ref={input}
          id="ai-search-q"
          type="search"
          value={question}
          maxLength={400}
          autoComplete="off"
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask AI about your screenings"
        />
        <button type="submit" className="btn btn-primary btn-small" disabled={busy || !question.trim()}>
          {busy ? 'Searching...' : 'Ask'}
        </button>
      </form>

      {!question && !answer && !notice && !error && (
        <ul className="ai-suggestions" aria-label="Try asking">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button type="button" className="ai-suggestion" onClick={() => { setQuestion(s); input.current?.focus() }}>{s}</button>
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <div className="ai-search-notice" role="status">
          <strong>{notice.title}.</strong> {notice.message}
        </div>
      )}
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
                    {onOpen
                      ? <button type="button" className="inline-link-btn" onClick={() => onOpen(r)}>{r.full_name}</button>
                      : r.full_name}{' '}
                    <Pill tone={info.tone}>{info.stamp}</Pill>
                    <span className="field-hint"> {fmtDate(r.submitted_at)}{r.review_decision ? `, you: ${r.review_decision}` : ''}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
