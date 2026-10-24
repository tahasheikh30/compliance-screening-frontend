import { safeUrl } from '../lib/format'
import { Pill } from './ui'

const VERDICT = {
  same_person: { tone: 'bad', label: 'Likely the same person' },
  possible_same_person: { tone: 'warn', label: 'Possibly the same person' },
  unlikely_same_person: { tone: 'good', label: 'Likely someone else' },
}
const ABOUT = { yes: ['bad', 'About the applicant'], likely: ['warn', 'Probably the applicant'], unlikely: ['good', 'Probably someone else'], unclear: ['warn', 'Unclear'] }
const RISK = {
  fraud: 'Fraud', terror_financing: 'Terror financing', terrorism_or_extremism: 'Terrorism or extremism',
  corruption_or_bribery: 'Corruption', money_laundering: 'Money laundering', sanctions_evasion: 'Sanctions evasion',
}
const riskLabel = (r) => RISK[r] || String(r).replace(/_/g, ' ')

function Link({ url, children }) {
  const href = safeUrl(url)
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>
}

/**
 * What the optional AI layer added to a screening, labelled as AI and kept apart from the list results above it.
 * Renders nothing when there is nothing to show (AI was off, or found nothing). Every claim here is a lead for a person
 * to check; none of it is a list result.
 */
export default function AiInsights({ insights, reasons = [] }) {
  if (!insights) return null
  const { search, triage, media, web, associates } = insights
  const items = triage?.items || []
  const near = items.filter((i) => i.near)
  const assessed = items.filter((i) => !i.near)
  const articles = (media?.items || []).filter((a) => safeUrl(a.link))
  const leads = web?.leads || []
  const people = (associates?.people || []).filter((p) => p.relatives?.length)
  const spelled = (search?.variants || []).length > 1 || search?.script === 'arabic'
  const nothing = !spelled && !items.length && !articles.length && !leads.length && !people.length && !reasons.length
  if (nothing) return null
  const failed = insights.ai?.failed || []

  return (
    <section className="ai-panel" aria-labelledby="ai-panel-heading">
      <header className="ai-panel-head">
        <h3 id="ai-panel-heading">AI search</h3>
        <Pill tone="warn">AI findings: verify before relying on them</Pill>
      </header>

      {reasons.length > 0 && (
        <div className="notice notice-warn" role="note">
          <p><strong>Moved to manual review.</strong></p>
          <ul>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      {spelled && (
        <div className="ai-block">
          <h4>{search.script === 'arabic' ? 'Urdu script name' : 'Spellings checked'}</h4>
          {search.script === 'arabic' && search.urdu && <p className="ai-urdu" dir="rtl" lang="ur">{search.urdu}</p>}
          <p className="field-hint">
            Every spelling below was screened against the lists.
            {!search.typed_exactly && ' Spellings guessed from Urdu script or by AI are leads: a match on one needs checking against the ID.'}
          </p>
          <ul className="ai-chips">
            {search.variants.map((v) => (
              <li key={v.name} className="ai-chip-item">{v.name}<span className="ai-origin"> {v.origin}</span></li>
            ))}
          </ul>
        </div>
      )}

      {near.length > 0 && (
        <div className="ai-block">
          <h4>Close names just under the threshold</h4>
          <ul className="ai-list">
            {near.map((i) => (
              <li key={i.key}>
                <strong>{i.name}</strong> <span className="field-hint">{i.list}, {i.score}%</span>{' '}
                <Pill tone={VERDICT[i.verdict]?.tone || 'warn'}>{VERDICT[i.verdict]?.label || i.verdict}</Pill>
                <div className="ai-reason">{i.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {assessed.length > 0 && (
        <div className="ai-block">
          <h4>Matches, read by AI</h4>
          {triage.suggest_clear && (
            <p className="notice notice-good" role="note">
              AI thinks every match here is someone else. This is a suggestion only: the result above is unchanged, and
              you decide.
            </p>
          )}
          <ul className="ai-list">
            {assessed.map((i) => (
              <li key={i.key}>
                <strong>{i.name}</strong> <span className="field-hint">{i.list}, {i.score}%</span>{' '}
                <Pill tone={VERDICT[i.verdict]?.tone || 'warn'}>{VERDICT[i.verdict]?.label || i.verdict}</Pill>
                <div className="ai-reason">{i.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {articles.length > 0 && (
        <div className="ai-block">
          <h4>Adverse media, read by AI</h4>
          <ul className="ai-list">
            {articles.map((a) => {
              const about = ABOUT[a.about_applicant] || ABOUT.unclear
              return (
                <li key={a.link}>
                  <Link url={a.link}>{a.title}</Link>{' '}
                  <Pill tone={about[0]}>{about[1]}</Pill>
                  {(a.risk_types || []).map((r) => <Pill key={r} tone="warn">{riskLabel(r)}</Pill>)}
                  {a.summary && <div className="ai-reason">{a.summary}</div>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {leads.length > 0 && (
        <div className="ai-block">
          <h4>Found on the open web</h4>
          <ul className="ai-list">
            {leads.map((l, i) => (
              <li key={i}>
                <strong>{l.office_or_relation || l.text}</strong>
                {l.person ? ` (${l.person})` : ''} <Pill tone="warn">{l.confidence} confidence</Pill>
                {l.period && <span className="field-hint"> {l.period}</span>}
                {l.office_or_relation && l.text && <div className="ai-reason">{l.text}</div>}
                {l.agreeing_details?.length > 0 && <div className="field-hint">Agrees on: {l.agreeing_details.join(', ')}</div>}
              </li>
            ))}
          </ul>
          {(web.sources || []).length > 0 && (
            <p className="field-hint">
              Sources:{' '}
              {web.sources.map((s, i) => (
                <span key={s.url}>{i > 0 && '; '}<Link url={s.url}>{s.title || s.url}</Link></span>
              ))}
            </p>
          )}
        </div>
      )}

      {people.length > 0 && (
        <div className="ai-block">
          <h4>Relatives and close associates of politically exposed persons</h4>
          <p className="field-hint">From Wikidata. A relative of a PEP is higher risk, not a match in itself.</p>
          <ul className="ai-list">
            {people.map((p) => (
              <li key={p.pep_id || p.pep_name}>
                <strong><Link url={p.url}>{p.pep_name}</Link></strong>
                <ul>
                  {p.relatives.map((r) => (
                    <li key={`${r.relation}-${r.name}`}>
                      <Link url={r.url}>{r.name}</Link> <span className="field-hint">{r.relation}</span>
                      {r.is_pep && <> <Pill tone="warn">Also a PEP</Pill></>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <p className="field-hint">Some AI steps did not finish ({failed.join(', ')}). The list results above are complete.</p>
      )}
    </section>
  )
}
