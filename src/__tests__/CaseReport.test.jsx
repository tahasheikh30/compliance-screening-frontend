import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../api', () => ({ downloadEvidence: vi.fn(() => Promise.resolve()) }))
import { downloadEvidence } from '../api'
import CaseReport from '../components/CaseReport'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const match = (over = {}) => ({
  list: 'UN Security Council Consolidated List', id: 'QDi.001', score: 97.5, matched_name: 'ALI KHAN BHAI',
  primary_name: 'MOHAMMAD ALI KHAN', type: 'Individual', programs: 'Al-Qaida', dob: '1975-03-04',
  dob_year_match: 'Yes', nationality: 'Pakistan', listed_on: '2001-10-17', remarks: 'Some remarks', aliases: ['ALI KHAN BHAI'], ...over,
})
const result = (source, status, extra = {}) => ({
  id: source.length * 10 + status.length, source, status, detail: `detail for ${source}`, matches: [], articles: [],
  evidence_file: null, list_version: null, records_screened: 100, ...extra,
})
const base = (results, overall) => ({
  applicant_id: 3, full_name: 'Muhammad Ali Khan', overall_status: overall, case_ref: 'CS-20261002-00003',
  threshold: 85, records_screened: 500, results,
})

describe('CaseReport', () => {
  it('shows a stamped escalation with the match, flags and evidence button', () => {
    const data = base([
      result('UNSC', 'HIT', { matches: [match()], match_count: 1, evidence_file: 'evidence_x.pdf', id: 11 }),
      result('OFAC', 'CLEAR'),
    ], 'ESCALATE_TO_COMPLIANCE')
    render(<CaseReport caseData={data} applicant={{ dob: '1975-03-04', nationality: 'Pakistan' }} />)
    expect(screen.getByRole('heading', { name: 'Potential watch-list match' })).toBeTruthy()
    expect(screen.getByText('Escalate')).toBeTruthy()
    expect(screen.getByText('CS-20261002-00003')).toBeTruthy()
    expect(screen.getByText('MOHAMMAD ALI KHAN')).toBeTruthy()
    expect(screen.getByText('Birth year matches')).toBeTruthy()
    expect(screen.getByText(/Matched on the alias ALI KHAN BHAI/)).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Name similarity 97.5 out of 100' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download evidence PDF' })).toBeTruthy()
  })

  it('does not show a birth-year flag when no date of birth was entered', () => {
    const data = base([result('UNSC', 'HIT', { matches: [match()], match_count: 1 })], 'ESCALATE_TO_COMPLIANCE')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.queryByText('Birth year matches')).toBeNull()
    expect(screen.queryByText('Birth year differs')).toBeNull()
  })

  it('says when only the best matches are shown out of a larger total', () => {
    const data = base([result('UNSC', 'HIT', { matches: [match()], match_count: 120 })], 'ESCALATE_TO_COMPLIANCE')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.getByText(/120 potential matches/)).toBeTruthy()
    expect(screen.getByText(/showing the best 1/)).toBeTruthy()
  })

  it('reports an incomplete screening instead of a clearance', () => {
    const data = base([
      result('UNSC', 'CLEAR'),
      result('OFAC', 'ERROR', { records_screened: 0, detail: 'Not screened. The list could not be downloaded.' }),
      result('FIA_REDBOOK', 'NOT_CONFIGURED', { records_screened: 0 }),
    ], 'MANUAL_REVIEW')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.getByRole('heading', { name: 'Needs manual review' })).toBeTruthy()
    expect(screen.getByText(/2 sources were not screened/)).toBeTruthy()
    expect(screen.getAllByText('Not screened').length).toBe(2)
    expect(screen.queryByText('0 records screened')).toBeNull()   // no misleading count for sources that did not run
    expect(screen.getAllByText('100 records screened').length).toBe(1) // the source that did run still shows its count
    expect(screen.queryByRole('button', { name: 'Download evidence PDF' })).toBeNull()
    expect(screen.queryByText('Clear', { selector: '.stamp' })).toBeNull()
  })

  it('renders a clear result with no evidence button', () => {
    render(<CaseReport caseData={base([result('UNSC', 'CLEAR', { list_version: '2026-09-30T08:00:00Z' })], 'AUTO_CLEAR')} applicant={{}} />)
    expect(screen.getByRole('heading', { name: 'No match found' })).toBeTruthy()
    expect(screen.getByText(/list dated/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Download evidence PDF' })).toBeNull()
  })

  it('only turns http(s) news links into links', () => {
    const articles = [
      { title: 'Safe story', link: 'https://news.example/a', source: 'Dawn', published: 'Tue', keyword: 'fraud' },
      { title: 'Hostile story', link: 'javascript:alert(1)', source: 'X', published: '', keyword: 'arrest' },
    ]
    render(<CaseReport caseData={base([result('ADVERSE_MEDIA', 'REVIEW', { articles })], 'MANUAL_REVIEW')} applicant={{}} />)
    const safe = screen.getByRole('link', { name: 'Safe story' })
    expect(safe.getAttribute('href')).toBe('https://news.example/a')
    expect(safe.getAttribute('rel')).toContain('noopener')
    expect(screen.queryByRole('link', { name: 'Hostile story' })).toBeNull()
    expect(screen.getByText('Hostile story')).toBeTruthy()
  })

  it('downloads the evidence of the first result that has one', async () => {
    const data = base([result('UNSC', 'HIT', { matches: [match()], match_count: 1, evidence_file: 'evidence_x.pdf', id: 77 })], 'ESCALATE_TO_COMPLIANCE')
    render(<CaseReport caseData={data} applicant={{}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download evidence PDF' }))
    await waitFor(() => expect(downloadEvidence).toHaveBeenCalledWith(77, 'evidence_x.pdf'))
  })

  it('shows the download error and lets the user dismiss it', async () => {
    downloadEvidence.mockRejectedValueOnce(Object.assign(new Error('Evidence file is missing'), { code: 'EVIDENCE_FILE_MISSING' }))
    const data = base([result('UNSC', 'HIT', { matches: [match()], match_count: 1, evidence_file: 'e.pdf', id: 5 })], 'ESCALATE_TO_COMPLIANCE')
    render(<CaseReport caseData={data} applicant={{}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download evidence PDF' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  })

  it('shows which FIA books were screened and flags the one that could not be read', () => {
    const lists = [
      { list: 'FIA Red Book 2026', records: 143, published: null, status: 'OK' },
      { list: 'FIA Red Book Most Wanted Terrorists', records: 0, published: null, status: 'Downloaded, but no records could be read (layout may have changed)' },
    ]
    const data = base([
      result('FIA_REDBOOK', 'PARTIAL', { lists, detail: 'Partly screened. ...' }),
      result('UNSC', 'CLEAR'),
    ], 'MANUAL_REVIEW')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.getByText('Incomplete', { selector: '.pill' })).toBeTruthy()
    expect(screen.getByText('Lists screened')).toBeTruthy()
    expect(screen.getByText('FIA Red Book 2026')).toBeTruthy()
    expect(screen.getByText('143 records')).toBeTruthy()
    expect(screen.getByText('FIA Red Book Most Wanted Terrorists')).toBeTruthy()
    expect(screen.getByText(/Not screened: Downloaded, but no records could be read/)).toBeTruthy()
    expect(screen.getByText(/were not fully screened|incomplete/i, { selector: '.notice' })).toBeTruthy()
    expect(screen.queryByText('Clear', { selector: '.stamp' })).toBeNull()
  })

  it('lists both books when both were read, and stays quiet for single-list sources', () => {
    const both = [
      { list: 'FIA Red Book 2026', records: 143, status: 'OK' },
      { list: 'FIA Red Book Most Wanted Terrorists', records: 1331, status: 'OK' },
    ]
    const data = base([
      result('FIA_REDBOOK', 'CLEAR', { lists: both }),
      result('UNSC', 'CLEAR', { lists: [{ list: 'UN Security Council Consolidated List', records: 100, status: 'OK' }] }),
    ], 'AUTO_CLEAR')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.getAllByText('Lists screened').length).toBe(1)      // only the FIA card
    expect(screen.getByText('1,331 records')).toBeTruthy()
  })

  it('calls out a CNIC match prominently and shows the father and CNIC evidence', () => {
    const m = match({
      list: 'NACTA Proscribed Persons (Fourth Schedule)', id: 'NACTA-1', primary_name: 'Muhammad Shakir', matched_name: 'Muhammad Shakir',
      score: 40, dob: '', dob_year_match: 'n/a', cnic: '3740565359881', cnic_match: true, father_name: 'Qabil Khan', father_match: false, aliases: [],
    })
    const data = base([result('NACTA', 'HIT', { matches: [m], match_count: 1, evidence_file: 'e.pdf', id: 9 })], 'ESCALATE_TO_COMPLIANCE')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.getByRole('alert').textContent).toMatch(/CNIC matches a listed person: Muhammad Shakir on NACTA/)
    expect(screen.getByText('CNIC matches')).toBeTruthy()
    expect(screen.getByText('Matched on CNIC')).toBeTruthy()
    expect(screen.getByText('Name similarity 40')).toBeTruthy()          // the weak name score is shown honestly, not as the headline
    expect(screen.queryByRole('img', { name: /Name similarity/ })).toBeNull()
    expect(screen.getByText('3740565359881')).toBeTruthy()
    expect(screen.getByText('Qabil Khan')).toBeTruthy()
    expect(screen.getByText("Father's name differs")).toBeTruthy()
  })

  it('shows no CNIC callout or flags when the applicant gave no CNIC', () => {
    const m = match({ cnic: '3740565359881', cnic_match: null, father_name: 'Qabil Khan', father_match: null })
    const data = base([result('NACTA', 'HIT', { matches: [m], match_count: 1 })], 'ESCALATE_TO_COMPLIANCE')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('CNIC matches')).toBeNull()
    expect(screen.queryByText('CNIC differs')).toBeNull()
    expect(screen.getByText('3740565359881')).toBeTruthy()      // the listed CNIC is still shown
  })

  it('says an out of date NACTA list is incomplete', () => {
    const lists = [{ list: 'NACTA Proscribed Persons (Fourth Schedule)', records: 5000, status: 'Out of date: this copy was loaded 45 days ago (limit 30). Upload a fresh export' }]
    const data = base([result('NACTA', 'PARTIAL', { lists, detail: 'Incomplete screening.' })], 'MANUAL_REVIEW')
    render(<CaseReport caseData={data} applicant={{}} />)
    expect(screen.getByText('Incomplete', { selector: '.pill' })).toBeTruthy()
    expect(screen.getByText(/Not screened: Out of date/)).toBeTruthy()
  })
})

