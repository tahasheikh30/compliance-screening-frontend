// One place for what each status means, so the report, history and lists
// views all describe results the same way.

export const SOURCES = {
  UNSC: { name: 'UN Security Council', short: 'UN', long: 'UN Security Council Consolidated List' },
  OFAC: { name: 'OFAC (US Treasury)', short: 'OFAC', long: 'OFAC SDN and Consolidated (Non-SDN) lists' },
  UKSL: { name: 'UK Sanctions List', short: 'UK', long: 'UK Sanctions List (FCDO)' },
  FIA_REDBOOK: { name: 'FIA Red Book', short: 'FIA', long: 'FIA Red Book (Pakistan, most wanted)' },
  ADVERSE_MEDIA: { name: 'Adverse media', short: 'News', long: 'Open news search (Google News)' },
}

export const SOURCE_ORDER = ['UNSC', 'OFAC', 'UKSL', 'FIA_REDBOOK', 'ADVERSE_MEDIA']

// tone drives colour: 'bad' red, 'warn' amber, 'good' green
export const RESULT_STATUS = {
  HIT: { label: 'Match', tone: 'bad' },
  REVIEW: { label: 'Review', tone: 'warn' },
  CLEAR: { label: 'Clear', tone: 'good' },
  ERROR: { label: 'Not screened', tone: 'bad' },
  NOT_CONFIGURED: { label: 'Not screened', tone: 'bad' },
}

export const OVERALL = {
  ESCALATE_TO_COMPLIANCE: {
    stamp: 'Escalate', tone: 'bad',
    headline: 'Potential watch-list match',
    next: 'Escalate to compliance. A match is not a confirmed identity, so verify date of birth and identifiers against the source record before any decision.',
  },
  MANUAL_REVIEW: {
    stamp: 'Review', tone: 'warn',
    headline: 'Needs manual review',
    next: 'Something needs a person to look at it: an adverse news lead, or a list that could not be screened. This is not a clearance.',
  },
  AUTO_CLEAR: {
    stamp: 'Clear', tone: 'good',
    headline: 'No match found',
    next: 'Every list was screened and nothing was found at this threshold. Automated name matching only, so it does not replace your normal checks.',
  },
}

export function resultStatus(status) {
  return RESULT_STATUS[status] || { label: status || 'Unknown', tone: 'warn' }
}

export function overallInfo(status) {
  return OVERALL[status] || { stamp: status || 'Unknown', tone: 'warn', headline: 'Unknown result', next: '' }
}

// What a person should do next. For a manual review the generic text is replaced
// by what actually triggered it, so they know where to look first.
export function nextStep(overall, sum) {
  if (overall !== 'MANUAL_REVIEW') return overallInfo(overall).next
  const parts = []
  if (sum.news > 0) {
    parts.push('A news article mentions this name next to a risk keyword. It may be about someone else with the same name, so read it before deciding.')
  }
  if (sum.notScreened > 0) {
    parts.push('At least one list could not be screened, so this is not a clearance. Screen again once the cause below is fixed.')
  }
  return parts.length ? parts.join(' ') : overallInfo(overall).next
}

// Counts for the verdict summary, computed from the result rows so it works
// for a fresh screening and for one reopened from history.
export function summarize(caseData) {
  const rows = caseData?.results || []
  let sanctions = 0
  let news = 0
  let notScreened = 0
  for (const r of rows) {
    if (r.source === 'ADVERSE_MEDIA') news += (r.articles || []).length
    else sanctions += r.match_count ?? (r.matches || []).length
    if (r.status === 'ERROR' || r.status === 'NOT_CONFIGURED') notScreened += 1
  }
  const withEvidence = rows.find((r) => r.evidence_file)
  return { sanctions, news, notScreened, evidenceResult: withEvidence || null }
}

export function orderedResults(results) {
  const rank = (s) => { const i = SOURCE_ORDER.indexOf(s); return i === -1 ? 99 : i }
  return [...(results || [])].sort((a, b) => rank(a.source) - rank(b.source))
}
