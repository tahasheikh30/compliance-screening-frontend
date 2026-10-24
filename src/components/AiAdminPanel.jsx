import { useEffect, useState } from 'react'
import { getAiAdmin, setAiAdmin, testAi } from '../api'
import ErrorBanner from './ErrorBanner'
import { Pill } from './ui'
import { setAiStatus } from '../lib/ai'
import { useToast } from './Toaster'

const STATE_PILL = {
  on: ['good', 'On'], off: ['warn', 'Off'], paused: ['warn', 'Resting'], unconfigured: ['bad', 'No key on the server'],
}

/**
 * Administrators: the AI search switch and its features. The key itself lives only in the server's environment and is
 * never shown here. With the switch off, or no key, the app works exactly as it does without AI.
 */
export default function AiAdminPanel() {
  const toast = useToast()
  const [cfg, setCfg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [test, setTest] = useState(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    getAiAdmin().then((c) => { if (active) setCfg(c) }).catch(() => { if (active) setLoadFailed(true) })
    return () => { active = false }
  }, [])

  async function apply(enabled, features) {
    setBusy(true); setError(null)
    try {
      const c = await setAiAdmin({ enabled, features })
      setCfg(c); setAiStatus(c)
      toast.info(c.enabled ? 'AI search is on' : 'AI search is off', { category: 'admin', log: false })
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  async function check() {
    setBusy(true); setError(null); setTest(null)
    try { setTest(await testAi()) } catch (e) { setError(e) } finally { setBusy(false) }
  }

  const pill = cfg ? STATE_PILL[cfg.state] || ['warn', cfg.state] : null
  return (
    <section className="ai-admin" aria-labelledby="ai-admin-heading">
      <header className="ai-panel-head">
        <h2 id="ai-admin-heading">AI search</h2>
        {pill && <Pill tone={pill[0]}>{pill[1]}</Pill>}
      </header>
      <p className="field-hint">
        Optional. When on, AI helps find people the lists miss, reads close names and news, handles Urdu script and drafts case memos.
        It only ever makes a result more cautious, and everything it adds is labelled. When off, or with no key, the app works as it always has.
      </p>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {loadFailed && <p className="field-hint">AI settings could not be loaded just now.</p>}
      {cfg && (
        <>
          <label className="check-row" htmlFor="ai-enabled">
            <input id="ai-enabled" type="checkbox" checked={cfg.enabled} disabled={busy || (!cfg.configured && !cfg.enabled)}
              onChange={(e) => apply(e.target.checked)} />
            <span>
              <span className="field-label">AI search switch</span>
              <span className="field-hint">
                {cfg.configured ? cfg.message : 'Add OPENROUTER_API_KEY to the server environment, restart it, then switch this on.'}
              </span>
            </span>
          </label>
          {cfg.configured && (
            <>
              <fieldset className="ai-features" disabled={busy}>
                <legend className="field-label">Features</legend>
                {cfg.feature_list.map((f) => (
                  <label key={f.key} className="check-row">
                    <input type="checkbox" checked={f.enabled} onChange={(e) => apply(cfg.enabled, { [f.key]: e.target.checked })} />
                    <span className="field-hint">{f.label}</span>
                  </label>
                ))}
              </fieldset>
              <dl className="facts ai-facts">
                <div className="fact"><dt>Model</dt><dd>{cfg.model}</dd></div>
                <div className="fact"><dt>Sent to the model</dt><dd>{cfg.privacy.sent}</dd></div>
                <div className="fact"><dt>Provider data use</dt><dd>{cfg.privacy.data_collection === 'deny' ? 'Providers may not keep or train on it' : cfg.privacy.data_collection}{cfg.privacy.zero_data_retention ? ', zero retention required' : ''}</dd></div>
                <div className="fact"><dt>Today</dt><dd>{cfg.usage_today.calls} calls, {cfg.usage_today.failures} failed (limit {cfg.limits.daily_calls})</dd></div>
                {cfg.last_error && <div className="fact"><dt>Last error</dt><dd>{cfg.last_error}</dd></div>}
              </dl>
              <div className="memo-actions">
                <button type="button" className="btn btn-quiet btn-small" onClick={check} disabled={busy}>Test the key</button>
                {test && <Pill tone={test.ok ? 'good' : 'bad'}>{test.ok ? 'Key accepted' : `Key not accepted: ${test.error}`}</Pill>}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
