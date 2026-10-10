// One place for what each status means, so the report, history and lists
// views all describe results the same way.

export const SOURCES = {
  UNSC: { name: 'UN Security Council', short: 'UN', long: 'UN Security Council Consolidated List' },
  OFAC: { name: 'OFAC (US Treasury)', short: 'OFAC', long: 'OFAC SDN and Consolidated (Non-SDN) lists' },
  UKSL: { name: 'UK Sanctions List', short: 'UK', long: 'UK Sanctions List (FCDO)' },
  FIA_REDBOOK: { name: 'FIA Red Books', short: 'FIA', long: 'FIA Red Books (Pakistan, most wanted)' },
  NACTA: { name: 'NACTA', short: 'NACTA', long: 'NACTA Proscribed Persons (Fourth Schedule, Pakistan)' },
  PEP: { name: 'Politically exposed persons', short: 'PEP', long: 'Politically exposed persons (national and provincial, Pakistan)' },
  ADVERSE_MEDIA: { name: 'Adverse media', short: 'News', long: 'Open news search (Google News)' },
}

export const SOURCE_ORDER = ['UNSC', 'OFAC', 'UKSL', 'FIA_REDBOOK', 'NACTA', 'PEP', 'ADVERSE_MEDIA']

// tone drives colour: 'bad' red, 'warn' amber, 'good' green
const RESULT_STATUS = {
  HIT: { label: 'Match', tone: 'bad' },
  REVIEW: { label: 'Review', tone: 'warn' },
  PARTIAL: { label: 'Incomplete', tone: 'warn' },
  CLEAR: { label: 'Clear', tone: 'good' },
  ERROR: { label: 'Not screened', tone: 'bad' },
  NOT_CONFIGURED: { label: 'Not screened', tone: 'bad' },
}

const OVERALL = {
  ESCALATE_TO_COMPLIANCE: {
    stamp: 'Escalate', tone: 'bad',
    headline: 'Potential watch-list match',
    next: 'Escalate to compliance. A match is not a confirmed identity, so verify date of birth and identifiers against the source record before any decision.',
  },
  MANUAL_REVIEW: {
    stamp: 'Review', tone: 'warn',
    headline: 'Needs manual review',
    next: 'Something needs a person to look at it: a possible politically exposed person, an adverse news lead, or a list that could not be screened. This is not a clearance.',
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
  if (sum.pep > 0) {
    parts.push('A possible politically exposed person (PEP). This is not a sanctions match: apply enhanced due diligence (source of funds and wealth, senior approval) once you have confirmed it is the same person.')
  }
  if (sum.news > 0) {
    parts.push('A news article mentions this name next to a risk keyword. It may be about someone else with the same name, so read it before deciding.')
  }
  if (sum.notScreened > 0) {
    parts.push('At least one list could not be screened, so this is not a clearance. Screen again once the cause below is fixed.')
  }
  if (sum.partial > 0) {
    parts.push('Part of a source was not fully screened (a list could not be read, or is out of date). See which below. This is not a clearance.')
  }
  return parts.length ? parts.join(' ') : overallInfo(overall).next
}

// Counts for the verdict summary, computed from the result rows so it works
// for a fresh screening and for one reopened from history.
export function summarize(caseData) {
  const rows = caseData?.results || []
  let sanctions = 0
  let news = 0
  let pep = 0
  let notScreened = 0
  let partial = 0
  for (const r of rows) {
    if (r.source === 'ADVERSE_MEDIA') news += (r.articles || []).length
    else if (r.source === 'PEP') pep += r.match_count ?? (r.matches || []).length   // not a sanction
    else sanctions += r.match_count ?? (r.matches || []).length
    if (r.status === 'ERROR' || r.status === 'NOT_CONFIGURED') notScreened += 1
    if (r.status === 'PARTIAL') partial += 1
  }
  const withEvidence = rows.find((r) => r.evidence_file)
  return { sanctions, news, pep, notScreened, partial, evidenceResult: withEvidence || null }
}

export function orderedResults(results) {
  const rank = (s) => { const i = SOURCE_ORDER.indexOf(s); return i === -1 ? 99 : i }
  return [...(results || [])].sort((a, b) => rank(a.source) - rank(b.source))
}

// Matches whose CNIC equals the applicant's: the strongest signal this tool can give.
export function cnicMatches(caseData) {
  const out = []
  for (const r of caseData?.results || []) {
    for (const m of r.matches || []) {
      if (m.cnic_match === true) out.push({ ...m, source: r.source })
    }
  }
  return out
}
