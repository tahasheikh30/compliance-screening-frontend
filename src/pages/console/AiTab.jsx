import { useEffect, useState } from 'react'
import { getAiUsage } from '../../api'
import AiAdminPanel from '../../components/AiAdminPanel'
import ErrorBanner from '../../components/ErrorBanner'
import { fmtNum } from '../../lib/format'

const RANGES = [7, 30, 90]

/** Dollars, with enough places that a few cheap calls do not show as zero. */
export function usd(v) {
  if (v == null || Number.isNaN(Number(v))) return 'n/a'
  const n = Number(v)
  return `$${n.toFixed(n !== 0 && Math.abs(n) < 1 ? 4 : 2)}`
}

function Tile({ label, value, note }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <span className="field-hint">{note}</span>}
    </div>
  )
}

/**
 * Administrators: the AI switch and what AI search has used. Spend comes from OpenRouter itself (the figures on the
 * OpenRouter dashboard for the server's key). Calls, tokens and the per answer cost are this server's own record, so
 * they can be split by day, feature and model. Only counts and dollars: never a name, prompt or answer.
 */
export default function AiTab() {
  const [days, setDays] = useState(30)
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setError(null)
    getAiUsage(days).then((u) => { if (active) setUsage(u) }).catch((e) => { if (active) setError(e) })
    return () => { active = false }
  }, [days])

  const or = usage?.openrouter
  const t = usage?.totals
  return (
    <div className="workspace workspace-single">
      <section className="sheet" aria-labelledby="ai-tab-heading">
        <div className="folder-tab">AI</div>
        <h1 id="ai-tab-heading">AI search</h1>
        <AiAdminPanel />

        <section className="ai-usage" aria-labelledby="ai-usage-heading">
          <header className="ai-panel-head">
            <h2 id="ai-usage-heading">Usage and cost</h2>
            <div className="filter-group" role="group" aria-label="Period">
              {RANGES.map((r) => (
                <button key={r} type="button" className={`filter-btn ${days === r ? 'filter-btn-on' : ''}`}
                  aria-pressed={days === r} onClick={() => setDays(r)}>{r} days</button>
              ))}
            </div>
          </header>
          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          {usage && (
            <>
              <h3>Spend, from OpenRouter</h3>
              {or?.ok ? (
                <dl className="tally">
                  <Tile label="Today" value={usd(or.daily_usd)} note="UTC day" />
                  <Tile label="This week" value={usd(or.weekly_usd)} />
                  <Tile label="This month" value={usd(or.monthly_usd)} />
                  <Tile label="All time" value={usd(or.usage_usd)} />
                  <Tile label="Credit left" value={or.limit_remaining_usd == null ? 'No limit set' : usd(or.limit_remaining_usd)}
                    note={or.limit_usd == null ? null : `of ${usd(or.limit_usd)}`} />
                </dl>
              ) : (
                <p className="field-hint">
                  {or?.error === 'not_configured'
                    ? 'No OpenRouter key is set on the server, so there is no spend to show.'
                    : 'OpenRouter could not be reached just now, so its spend figures are not shown. This server\'s own counts below are unaffected.'}
                </p>
              )}

              <h3>Used through this app, last {usage.days} days</h3>
              <dl className="tally">
                <Tile label="AI calls" value={fmtNum(t.calls)} note={t.failures ? `${fmtNum(t.failures)} failed` : null} />
                <Tile label="Tokens in" value={fmtNum(t.tokens_in)} />
                <Tile label="Tokens out" value={fmtNum(t.tokens_out)} />
                <Tile label="Cost" value={usd(t.cost_usd)} note="as OpenRouter charged each answer" />
              </dl>

              {usage.by_feature.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">Usage by feature and model</caption>
                    <thead><tr>
                      <th scope="col">Feature</th><th scope="col">Model</th>
                      <th scope="col" className="num">Calls</th><th scope="col" className="num">Tokens in</th>
                      <th scope="col" className="num">Tokens out</th><th scope="col" className="num">Cost</th>
                    </tr></thead>
                    <tbody>
                      {usage.by_feature.map((r) => (
                        <tr key={`${r.feature}-${r.model}`}>
                          <td>{r.feature}</td><td className="mono">{r.model}</td>
                          <td className="num">{fmtNum(r.calls)}</td><td className="num">{fmtNum(r.tokens_in)}</td>
                          <td className="num">{fmtNum(r.tokens_out)}</td><td className="num">{usd(r.cost_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {usage.daily.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="visually-hidden">Usage by day</caption>
                    <thead><tr>
                      <th scope="col">Day (UTC)</th><th scope="col" className="num">Calls</th>
                      <th scope="col" className="num">Tokens in</th><th scope="col" className="num">Tokens out</th>
                      <th scope="col" className="num">Cost</th>
                    </tr></thead>
                    <tbody>
                      {usage.daily.map((r) => (
                        <tr key={r.day}>
                          <td>{r.day}</td><td className="num">{fmtNum(r.calls)}</td>
                          <td className="num">{fmtNum(r.tokens_in)}</td><td className="num">{fmtNum(r.tokens_out)}</td>
                          <td className="num">{usd(r.cost_usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {usage.daily.length === 0 && <p className="field-hint">No AI calls in this period.</p>}
              {usage.today && usage.limits && (
                <p className="field-hint">
                  Today (UTC): {fmtNum(usage.today.calls)} of {usage.limits.daily_calls ? fmtNum(usage.limits.daily_calls) : 'unlimited'} daily AI calls used.
                  {usage.limits.daily_calls > 0 && usage.today.calls >= usage.limits.daily_calls
                    ? ' The limit has been reached, so AI is paused until the next UTC day. Screenings still run without it.'
                    : ' Once the limit is reached, AI pauses until the next UTC day and screenings carry on without it.'}
                </p>
              )}
            </>
          )}
        </section>
      </section>
    </div>
  )
}
