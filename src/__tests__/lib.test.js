import { describe, it, expect } from 'vitest'
import { summarize, nextStep, overallInfo, resultStatus, orderedResults } from '../lib/status'
import { listDateLabel, plural, safeUrl, dateOrNull, caseRef, fmtAge } from '../lib/format'

const row = (source, status, extra = {}) => ({ id: Math.random(), source, status, matches: [], articles: [], ...extra })

describe('summarize', () => {
  it('counts true match totals, news leads and unscreened sources', () => {
    const s = summarize({
      results: [
        row('UNSC', 'HIT', { matches: [{}], match_count: 7, evidence_file: 'e.pdf' }),
        row('ADVERSE_MEDIA', 'REVIEW', { articles: [{}, {}] }),
        row('OFAC', 'ERROR'),
        row('FIA_REDBOOK', 'NOT_CONFIGURED'),
        row('UKSL', 'CLEAR'),
      ],
    })
    expect(s.sanctions).toBe(7)           // match_count wins over the capped list
    expect(s.news).toBe(2)
    expect(s.notScreened).toBe(2)
    expect(s.evidenceResult.evidence_file).toBe('e.pdf')
  })
  it('falls back to the list length when match_count is absent (older backend)', () => {
    expect(summarize({ results: [row('UNSC', 'HIT', { matches: [{}, {}] })] }).sanctions).toBe(2)
  })
  it('handles an empty or missing case', () => {
    expect(summarize(null)).toMatchObject({ sanctions: 0, news: 0, notScreened: 0, evidenceResult: null })
  })
})

describe('nextStep', () => {
  it('is specific about what triggered a manual review', () => {
    expect(nextStep('MANUAL_REVIEW', { news: 1, notScreened: 0 })).toMatch(/news article/)
    expect(nextStep('MANUAL_REVIEW', { news: 0, notScreened: 2 })).toMatch(/could not be screened/)
    const both = nextStep('MANUAL_REVIEW', { news: 1, notScreened: 1 })
    expect(both).toMatch(/news article/)
    expect(both).toMatch(/could not be screened/)
  })
  it('uses the standard text for other outcomes', () => {
    expect(nextStep('ESCALATE_TO_COMPLIANCE', {})).toBe(overallInfo('ESCALATE_TO_COMPLIANCE').next)
    expect(nextStep('AUTO_CLEAR', {})).toBe(overallInfo('AUTO_CLEAR').next)
  })
})

describe('status lookups', () => {
  it('never claims a clear result for an unknown status', () => {
    expect(resultStatus('WHATEVER').tone).toBe('warn')
    expect(overallInfo('WHATEVER').tone).toBe('warn')
  })
  it('treats both unscreened statuses as failures', () => {
    expect(resultStatus('ERROR').tone).toBe('bad')
    expect(resultStatus('NOT_CONFIGURED').tone).toBe('bad')
    expect(resultStatus('ERROR').label).toBe(resultStatus('NOT_CONFIGURED').label)
  })
  it('orders sources consistently, unknown ones last', () => {
    const out = orderedResults([row('ADVERSE_MEDIA', 'CLEAR'), row('MYSTERY', 'CLEAR'), row('UNSC', 'CLEAR'), row('OFAC', 'CLEAR')])
    expect(out.map((r) => r.source)).toEqual(['UNSC', 'OFAC', 'ADVERSE_MEDIA', 'MYSTERY'])
  })
})

describe('format helpers', () => {
  it('describes list dates honestly', () => {
    expect(listDateLabel('2026-09-30T08:00:00.000Z')).toMatch(/^list dated /)
    expect(listDateLabel('Retrieved live')).toBe('downloaded live')
    expect(listDateLabel('n/a')).toBeNull()
    expect(listDateLabel('')).toBeNull()
    expect(listDateLabel('n/a; 2026-09-29')).toMatch(/^list dated /)
  })
  it('only returns real dates from dateOrNull', () => {
    expect(dateOrNull('2026-09-29')).toMatch(/2026/)
    expect(dateOrNull('Retrieved live')).toBeNull()
    expect(dateOrNull('n/a')).toBeNull()
  })
  it('pluralises', () => {
    expect(plural(1, 'record', 'records')).toBe('1 record')
    expect(plural(0, 'record', 'records')).toBe('0 records')
    expect(plural(12345, 'record', 'records')).toMatch(/records$/)
  })
  it('only allows http and https links', () => {
    expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>')).toBeNull()
    expect(safeUrl('not a url')).toBeNull()
    expect(safeUrl(undefined)).toBeNull()
  })
  it('builds a case reference', () => {
    expect(caseRef({ case_ref: 'CS-20261002-00012', applicant_id: 12 })).toBe('CS-20261002-00012')
    expect(caseRef({ applicant_id: 12 })).toBe('CS-00012')
    expect(caseRef(null)).toBe('')
  })
  it('formats ages', () => {
    expect(fmtAge(30)).toBe('30 s ago')
    expect(fmtAge(600)).toBe('10 min ago')
    expect(fmtAge(7200)).toBe('2 h ago')
  })
})
