import { forwardRef, useState } from 'react'
import { downloadEvidence } from '../api'
import { fmtDate, fmtNum, caseRef, safeUrl, listDateLabel, plural } from '../lib/format'
import { SOURCES, overallInfo, nextStep, resultStatus, summarize, orderedResults } from '../lib/status'
import ErrorBanner from './ErrorBanner'
import { Stamp, Pill } from './ui'

function ScoreMeter({ score }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0))
  return (
    <span className="meter-wrap">
      <span className="meter" role="img" aria-label={`Name similarity ${pct} out of 100`}>
        <span className="meter-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="meter-num">{pct}</span>
    </span>
  )
}

function Fact({ label, children }) {
  if (children == null || children === '') return null
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function MatchItem({ match, applicantHasDob }) {
  const aliasMatched = match.matched_name && match.matched_name !== match.primary_name
  return (
    <li className="match">
      <div className="match-head">
        <div>
          <div className="match-name">{match.primary_name}</div>
          {aliasMatched && <div className="match-alias">Matched on the alias {match.matched_name}</div>}
        </div>
        <ScoreMeter score={match.score} />
      </div>
      <dl className="facts">
        <Fact label="Reference"><span className="mono">{match.id}</span></Fact>
        <Fact label="List">{match.list}</Fact>
        <Fact label="Type">{match.type}</Fact>
        <Fact label="Programme">{match.programs}</Fact>
        <Fact label="Date of birth">
          {match.dob || 'Not listed'}
          {applicantHasDob && match.dob_year_match === 'Yes' && <> <Pill tone="bad">Birth year matches</Pill></>}
          {applicantHasDob && match.dob_year_match === 'No' && <> <Pill tone="good">Birth year differs</Pill></>}
        </Fact>
        <Fact label="Nationality">{match.nationality}</Fact>
        <Fact label="Listed on">{match.listed_on}</Fact>
      </dl>
      {match.aliases?.length > 0 && (
        <p className="match-extra"><span className="match-extra-label">Other names</span> {match.aliases.join('; ')}</p>
      )}
      {match.remarks && (
        <details className="match-remarks">
          <summary>Source remarks</summary>
          <p>{match.remarks}</p>
        </details>
      )}
    </li>
  )
}

function ArticleItem({ article }) {
  const href = safeUrl(article.link)
  return (
    <li className="article">
      {href
        ? <a href={href} target="_blank" rel="noopener noreferrer" className="article-title">{article.title}</a>
        : <span className="article-title">{article.title}</span>}
      <div className="article-meta">
        {[article.source, article.published, article.keyword && `keyword: ${article.keyword}`].filter(Boolean).join(' | ')}
      </div>
    </li>
  )
}

function SourceCard({ result, applicantHasDob }) {
  const src = SOURCES[result.source] || { name: result.source, long: result.source }
  const st = resultStatus(result.status)
  const matches = result.matches || []
  const articles = result.articles || []
  const total = result.match_count ?? matches.length
  const notScreened = result.status === 'ERROR' || result.status === 'NOT_CONFIGURED'
  const detail = notScreened ? '' : [
    result.records_screened != null && (result.source === 'ADVERSE_MEDIA'
      ? `${plural(result.records_screened, 'article', 'articles')} reviewed`
      : `${plural(result.records_screened, 'record', 'records')} screened`),
    listDateLabel(result.list_version),
  ].filter(Boolean).join(' | ')
  // The count, scores and caveats are already shown by the expandable list below,
  // so the sentence from the backend is only needed when there is nothing to expand.
  const showDetail = matches.length === 0 && articles.length === 0

  return (
    <article className={`source source-${st.tone}`} aria-label={src.name}>
      <header className="source-head">
        <div>
          <h3>{src.name}</h3>
          {detail && <p className="source-meta">{detail}</p>}
        </div>
        <Pill tone={st.tone}>{st.label}</Pill>
      </header>
      {showDetail && <p className="source-detail">{result.detail}</p>}

      {matches.length > 0 && (
        <details className="source-matches" open={result.status === 'HIT'}>
          <summary>
            {total} potential {total === 1 ? 'match' : 'matches'}
            {total > matches.length && <span className="summary-note"> (showing the best {matches.length})</span>}
          </summary>
          <ul className="match-list">
            {matches.map((m) => <MatchItem key={`${m.list}-${m.id}`} match={m} applicantHasDob={applicantHasDob} />)}
          </ul>
        </details>
      )}

      {articles.length > 0 && (
        <details className="source-matches" open>
          <summary>{articles.length} news {articles.length === 1 ? 'article' : 'articles'}</summary>
          <ul className="article-list">
            {articles.map((a, i) => <ArticleItem key={`${a.link}-${i}`} article={a} />)}
          </ul>
          <p className="source-caution">News hits are unverified leads. The person in an article may be someone else with the same name.</p>
        </details>
      )}
    </article>
  )
}

/**
 * The full outcome of one screening: a stamped verdict, counts, the next step,
 * the evidence download, and one card per source. Used for a fresh screening
 * and for a case reopened from history, so both read the same.
 *
 * `applicant` carries what the response does not: { dob, nationality }.
 */
const CaseReport = forwardRef(function CaseReport({ caseData, applicant }, headingRef) {
  const [downloadError, setDownloadError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const info = overallInfo(caseData.overall_status)
  const sum = summarize(caseData)
  const results = orderedResults(caseData.results)
  const applicantHasDob = !!applicant?.dob

  async function onDownload() {
    if (!sum.evidenceResult) return
    setDownloadError(null)
    setDownloading(true)
    try {
      await downloadEvidence(sum.evidenceResult.id, sum.evidenceResult.evidence_file)
    } catch (err) {
      setDownloadError(err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="report" aria-labelledby="report-heading">
      <header className={`verdict verdict-${info.tone}`}>
        <div className="verdict-text">
          <p className="verdict-ref">
            <span className="mono">{caseRef(caseData)}</span>
          </p>
          <h2 id="report-heading" ref={headingRef} tabIndex={-1}>{info.headline}</h2>
          <p className="verdict-applicant">
            {caseData.full_name}
            {applicant?.dob && <span className="verdict-sub">born {fmtDate(applicant.dob)}</span>}
            {applicant?.nationality && <span className="verdict-sub">{applicant.nationality}</span>}
          </p>
        </div>
        <Stamp tone={info.tone} large>{info.stamp}</Stamp>
      </header>

      <dl className="tally">
        <div><dt>Watch-list matches</dt><dd className={sum.sanctions ? 'tally-bad' : ''}>{fmtNum(sum.sanctions)}</dd></div>
        <div><dt>News leads</dt><dd className={sum.news ? 'tally-warn' : ''}>{fmtNum(sum.news)}</dd></div>
        <div><dt>Records screened</dt><dd>{fmtNum(caseData.records_screened)}</dd></div>
        <div><dt>Match threshold</dt><dd>{caseData.threshold != null ? `${caseData.threshold}%` : 'n/a'}</dd></div>
      </dl>

      {sum.notScreened > 0 && (
        <p className="notice notice-warn" role="note">
          {sum.notScreened === 1 ? 'One source was' : `${sum.notScreened} sources were`} not screened, so this result
          is incomplete. Check the cards below for the reason, then screen again.
        </p>
      )}

      <div className="next-step">
        <p>{nextStep(caseData.overall_status, sum)}</p>
        {sum.evidenceResult && (
          <button type="button" className="btn btn-primary" onClick={onDownload} disabled={downloading}>
            {downloading ? 'Preparing PDF...' : 'Download evidence PDF'}
          </button>
        )}
      </div>
      <ErrorBanner error={downloadError} onRetry={onDownload} onDismiss={() => setDownloadError(null)} />

      <div className="sources">
        {results.map((r) => <SourceCard key={r.id} result={r} applicantHasDob={applicantHasDob} />)}
      </div>

      <p className="disclaimer">
        Automated fuzzy-name matching only. Date of birth and nationality are shown as supporting evidence and
        never filter matches. No adverse action should be taken without a compliance officer confirming identity
        against the source record.
      </p>
    </section>
  )
})

export default CaseReport
