import { useEffect, useState } from 'react'
import { approveMemo, downloadMemo, draftMemo, getMemo, saveMemo } from '../api'
import ErrorBanner from './ErrorBanner'
import { Pill } from './ui'
import { fmtDateTime } from '../lib/format'

const REC = { clear: 'Clear', review: 'Manual review', escalate: 'Escalate to compliance' }
const REC_RANK = { clear: 0, review: 1, escalate: 2 }
const OUTCOME = { AUTO_CLEAR: 'Clear', MANUAL_REVIEW: 'Manual review', ESCALATE_TO_COMPLIANCE: 'Escalate to compliance' }
const FLOOR = { AUTO_CLEAR: 'clear', MANUAL_REVIEW: 'review', ESCALATE_TO_COMPLIANCE: 'escalate' }

/**
 * The case memo: a draft narrative, every statement citing numbered evidence, that the officer edits and approves.
 * It works without AI (a fixed template); with AI it reads better. It can never recommend less than the screening's own
 * outcome, and editing returns it to draft.
 */
export default function MemoPanel({ applicantId, overallStatus }) {
  const [memo, setMemo] = useState(undefined)       // undefined: loading, null: none yet
  const [aiAvailable, setAiAvailable] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [confirmRedraft, setConfirmRedraft] = useState(false)

  useEffect(() => {
    let active = true
    getMemo(applicantId).then((r) => { if (active) { setMemo(r.memo); setAiAvailable(!!r.ai_available) } })
      .catch(() => { if (active) setMemo(false) })
    return () => { active = false }
  }, [applicantId])

  async function run(kind, fn) {
    setBusy(kind); setError(null)
    try {
      const r = await fn()
      if (r) { setMemo(r.memo); setAiAvailable(!!r.ai_available) }
      return r
    } catch (e) { setError(e) } finally { setBusy('') }
    return null
  }

  const floor = FLOOR[overallStatus] || 'review'
  const startEdit = () => {
    setForm({
      headline: memo.headline || '',
      sections: (memo.sections || []).map((s) => ({ title: s.title, text: s.text, refs: s.refs || [] })),
      recommendation: memo.recommendation,
      open_questions: (memo.open_questions || []).join('\n'),
    })
    setEditing(true)
  }
  async function save() {
    const r = await run('save', () => saveMemo(applicantId, {
      headline: form.headline, sections: form.sections, recommendation: form.recommendation,
      open_questions: form.open_questions.split('\n').map((q) => q.trim()).filter(Boolean),
    }))
    if (r) setEditing(false)
  }
  const setSection = (i, patch) => setForm((f) => ({ ...f, sections: f.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))

  return (
    <section className="memo-panel" aria-labelledby="memo-heading">
      <header className="ai-panel-head">
        <h3 id="memo-heading">Case memo</h3>
        {memo && <Pill tone={memo.status === 'approved' ? 'good' : 'warn'}>{memo.status === 'approved' ? 'Approved' : 'Draft'}</Pill>}
        {memo && <Pill tone="warn">{memo.source === 'ai' ? 'Written with AI' : 'Written from a template'}</Pill>}
      </header>

      {memo === undefined && <p className="field-hint">Loading...</p>}
      {memo === false && <p className="field-hint"> The memo could not be loaded just now.</p>}

      {memo === null && (
        <div className="memo-empty">
          <p className="field-hint">
            A short memo for the file, built from this case's evidence. {aiAvailable ? 'AI will write it.' : 'It is written from a fixed template.'}{' '}
            You edit it and approve it before it counts.
          </p>
          <button type="button" className="btn btn-primary btn-small" onClick={() => run('draft', () => draftMemo(applicantId))} disabled={!!busy}>
            {busy === 'draft' ? 'Drafting...' : 'Draft memo'}
          </button>
        </div>
      )}

      {memo && !editing && (
        <>
          <h4 className="memo-headline">{memo.headline}</h4>
          {memo.system_outcome && <p><strong>Screening outcome:</strong> {OUTCOME[memo.system_outcome] || memo.system_outcome}</p>}
          <p><strong>Recommendation:</strong> {REC[memo.recommendation] || memo.recommendation}</p>
          {(memo.sections || []).map((s, i) => (
            <div key={i} className="memo-section">
              <h5>{s.title}</h5>
              <p>{s.text}</p>
              {s.refs?.length > 0 && <p className="field-hint">Evidence: {s.refs.join(', ')}</p>}
            </div>
          ))}
          {memo.open_questions?.length > 0 && (
            <div className="memo-section">
              <h5>Still to confirm</h5>
              <ul>{memo.open_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
          <details className="memo-evidence">
            <summary>Evidence ({(memo.facts || []).length} items)</summary>
            <ul>{(memo.facts || []).map((f) => <li key={f.ref}><span className="mono">{f.ref}</span> {f.text}</li>)}</ul>
          </details>
          <p className="field-hint">
            {memo.status === 'approved'
              ? `Approved by ${memo.approved_by} on ${fmtDateTime(memo.approved_at)}.`
              : memo.edited_by ? `Last edited by ${memo.edited_by}.` : 'Not yet approved.'}
          </p>
          <div className="memo-actions">
            <button type="button" className="btn btn-quiet btn-small" onClick={startEdit} disabled={!!busy}>Edit</button>
            {memo.status !== 'approved' && (
              <button type="button" className="btn btn-primary btn-small" onClick={() => run('approve', () => approveMemo(applicantId))} disabled={!!busy}>
                {busy === 'approve' ? 'Approving...' : 'Approve memo'}
              </button>
            )}
            <button type="button" className="btn btn-quiet btn-small" onClick={() => run('pdf', async () => { await downloadMemo(applicantId) })} disabled={!!busy}>
              {busy === 'pdf' ? 'Preparing PDF...' : 'Download memo PDF'}
            </button>
            {memo.status === 'approved' && confirmRedraft ? (
              <>
                <span className="field-hint">Replace the approved memo?</span>
                <button type="button" className="btn btn-danger btn-small" disabled={!!busy}
                  onClick={async () => { await run('draft', () => draftMemo(applicantId, { replace: true })); setConfirmRedraft(false) }}>
                  {busy === 'draft' ? 'Drafting...' : 'Yes, replace it'}
                </button>
                <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirmRedraft(false)} disabled={!!busy}>Keep it</button>
              </>
            ) : (
              <button type="button" className="btn btn-quiet btn-small" disabled={!!busy}
                onClick={() => (memo.status === 'approved' ? setConfirmRedraft(true) : run('draft', () => draftMemo(applicantId)))}>
                {busy === 'draft' ? 'Drafting...' : 'Redraft'}
              </button>
            )}
          </div>
        </>
      )}

      {memo && editing && form && (
        <form className="memo-edit" onSubmit={(e) => { e.preventDefault(); save() }}>
          <label className="field">
            <span className="field-label">Headline</span>
            <input value={form.headline} maxLength={200} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">Recommendation</span>
            <select value={form.recommendation} onChange={(e) => setForm({ ...form, recommendation: e.target.value })}>
              {Object.entries(REC).map(([k, v]) => <option key={k} value={k} disabled={REC_RANK[k] < REC_RANK[floor]}>{v}</option>)}
            </select>
            <span className="field-hint">It cannot be lower than the screening's own outcome.</span>
          </label>
          {form.sections.map((s, i) => (
            <label key={i} className="field">
              <span className="field-label">{s.title}</span>
              <textarea rows={4} maxLength={3000} value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} />
              <span className="field-hint">Cite evidence as [E1]. Evidence that does not exist is removed on save.</span>
            </label>
          ))}
          <label className="field">
            <span className="field-label">Still to confirm (one per line)</span>
            <textarea rows={3} value={form.open_questions} onChange={(e) => setForm({ ...form, open_questions: e.target.value })} />
          </label>
          <div className="memo-actions">
            <button type="submit" className="btn btn-primary btn-small" disabled={!!busy}>{busy === 'save' ? 'Saving...' : 'Save as draft'}</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setEditing(false)} disabled={!!busy}>Cancel</button>
          </div>
        </form>
      )}
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
    </section>
  )
}
