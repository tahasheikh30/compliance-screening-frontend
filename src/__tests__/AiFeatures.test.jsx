import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const api = vi.hoisted(() => ({}))
vi.mock('../api', async () => {
  const { aiApi } = await import('./aiMocks')
  Object.assign(api, aiApi)
  return { ...aiApi }
})

import { ToastProvider } from '../components/Toaster'
import AiChip from '../components/AiChip'
import AiInsights from '../components/AiInsights'
import MemoPanel from '../components/MemoPanel'
import AiAdminPanel from '../components/AiAdminPanel'
import CopilotPanel from '../components/CopilotPanel'
import { resetAiStatus } from '../lib/ai'

const ON = { state: 'on', configured: true, enabled: true, available: true, message: 'AI search is on.',
  features: { triage: true, memo: true, copilot: true, media: true, variants: true } }

beforeEach(() => { resetAiStatus() })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('AI status chip', () => {
  it('tells the person AI search is off', async () => {
    render(<AiChip />)
    expect(await screen.findByText('AI search is off')).toBeTruthy()
  })
  it('says it is on when an administrator has switched it on', async () => {
    api.getAiStatus.mockResolvedValueOnce(ON)
    render(<AiChip />)
    expect(await screen.findByText('AI search is on')).toBeTruthy()
  })
})

describe('AI insights', () => {
  it('renders nothing when AI added nothing', () => {
    const { container } = render(<AiInsights insights={{ version: 1, ai: { state: 'off' } }} />)
    expect(container.textContent).toBe('')
  })
  it('labels AI findings, shows reasons, leads and only real links', () => {
    render(<AiInsights reasons={['AI search: X may be the same person.']} insights={{
      search: { script: 'arabic', urdu: 'محمد', typed_exactly: false, variants: [{ name: 'MUHAMMAD', origin: 'dictionary' }, { name: 'MOHAMMAD', origin: 'rules' }] },
      triage: { suggest_clear: true, items: [
        { key: 'a', list: 'UN', id: '1', name: 'SOME ONE', score: 80, near: true, verdict: 'possible_same_person', confidence: 'medium', reason: 'Same birth year.' },
        { key: 'b', list: 'OFAC', id: '2', name: 'OTHER', score: 90, near: false, verdict: 'unlikely_same_person', confidence: 'high', reason: 'Different country.' }] },
      media: { items: [{ link: 'https://news.example/a', title: 'Fraud case', about_applicant: 'likely', risk_types: ['fraud'], summary: 'Charged.' },
        { link: 'javascript:alert(1)', title: 'Bad link', about_applicant: 'yes', risk_types: [], summary: '' }] },
      web: { leads: [{ kind: 'public_office', text: 'Served as MPA', office_or_relation: 'MPA', person: '', period: '2018', agreeing_details: ['birth year'], confidence: 'medium' }],
        sources: [{ url: 'https://gov.example/x', title: 'Assembly' }] },
      associates: { people: [{ pep_name: 'A PEP', pep_id: 'Q1', url: 'https://www.wikidata.org/wiki/Q1', relatives: [{ name: 'Brother', relation: 'sibling', url: 'https://www.wikidata.org/wiki/Q2', is_pep: true }] }] },
    }} />)
    expect(screen.getByText(/verify before relying on them/)).toBeTruthy()
    expect(screen.getByText(/Moved to manual review/)).toBeTruthy()
    expect(screen.getByText('Possibly the same person')).toBeTruthy()
    expect(screen.getByText(/suggestion only/)).toBeTruthy()
    expect(screen.getByText('Fraud')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Fraud case' }).getAttribute('href')).toBe('https://news.example/a')
    expect(screen.queryByRole('link', { name: 'Bad link' })).toBeNull()
    expect(screen.queryByText('Bad link')).toBeNull()      // an article without a safe link is not shown at all
    expect(screen.getByText('Also a PEP')).toBeTruthy()
  })
})

describe('case memo', () => {
  const memo = (over = {}) => ({ status: 'draft', source: 'template', headline: 'Escalate.', recommendation: 'escalate',
    sections: [{ title: 'Findings', text: 'A match [E1].', refs: ['E1'] }], open_questions: ['Confirm ID'],
    facts: [{ ref: 'E1', text: 'UN list match' }], ...over })

  it('offers to draft a memo and shows it', async () => {
    api.draftMemo.mockResolvedValue({ memo: memo(), ai_available: false })
    render(<MemoPanel applicantId={5} overallStatus="ESCALATE_TO_COMPLIANCE" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Draft memo' }))
    expect(await screen.findByText('A match [E1].')).toBeTruthy()
    expect(screen.getByText('Written from a template')).toBeTruthy()
    expect(api.draftMemo).toHaveBeenCalledWith(5)
  })
  it('approves a draft', async () => {
    api.getMemo.mockResolvedValue({ memo: memo(), ai_available: true })
    api.approveMemo.mockResolvedValue({ memo: memo({ status: 'approved', approved_by: 'ana@example.com', approved_at: '2026-10-24T08:00:00+00:00' }), ai_available: true })
    render(<MemoPanel applicantId={5} overallStatus="ESCALATE_TO_COMPLIANCE" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve memo' }))
    expect(await screen.findByText('Approved')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve memo' })).toBeNull()
  })
  it('does not let the recommendation go below the screening outcome', async () => {
    api.getMemo.mockResolvedValue({ memo: memo(), ai_available: false })
    render(<MemoPanel applicantId={5} overallStatus="ESCALATE_TO_COMPLIANCE" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('option', { name: 'Clear' }).disabled).toBe(true)
    expect(screen.getByRole('option', { name: 'Manual review' }).disabled).toBe(true)
    expect(screen.getByRole('option', { name: 'Escalate to compliance' }).disabled).toBe(false)
  })
  it('saves an edit as a draft', async () => {
    api.getMemo.mockResolvedValue({ memo: memo(), ai_available: false })
    api.saveMemo.mockResolvedValue({ memo: memo({ headline: 'Changed.' }), ai_available: false })
    render(<MemoPanel applicantId={5} overallStatus="MANUAL_REVIEW" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Changed.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(api.saveMemo).toHaveBeenCalled())
    expect(api.saveMemo.mock.calls[0][1].headline).toBe('Changed.')
    expect(await screen.findByText('Changed.')).toBeTruthy()
  })
})

describe('admin AI switch', () => {
  const cfg = (over = {}) => ({ ...ON, enabled: false, state: 'off', available: false, message: 'AI search is off.',
    feature_list: [{ key: 'triage', label: 'Rank near matches', enabled: true }], model: 'm/x', web_model: 'm/x',
    privacy: { data_collection: 'deny', zero_data_retention: false, sent: 'Name, birth year.' },
    usage_today: { calls: 2, failures: 0, tokens_in: 1, tokens_out: 1 }, limits: { daily_calls: 500, daily_calls_per_person: 100 }, last_error: null, ...over })

  it('switches AI search on and updates what everyone sees', async () => {
    api.getAiAdmin.mockResolvedValue(cfg())
    api.setAiAdmin.mockResolvedValue(cfg({ enabled: true, state: 'on', available: true, message: 'AI search is on.' }))
    render(<ToastProvider><AiAdminPanel /></ToastProvider>)
    fireEvent.click(await screen.findByLabelText(/AI search switch/))
    await waitFor(() => expect(api.setAiAdmin).toHaveBeenCalledWith({ enabled: true, features: undefined }))
    expect(await screen.findByText('On')).toBeTruthy()
  })
  it('cannot be switched on without a key on the server', async () => {
    api.getAiAdmin.mockResolvedValue(cfg({ configured: false, state: 'unconfigured', message: 'AI search is not set up on this server.' }))
    render(<ToastProvider><AiAdminPanel /></ToastProvider>)
    expect((await screen.findByLabelText(/AI search switch/)).disabled).toBe(true)
    expect(screen.getByText(/OPENROUTER_API_KEY/)).toBeTruthy()
  })
})

describe('copilot', () => {
  it('works with filters when AI search is off, and says questions are unavailable', async () => {
    api.askCopilot.mockResolvedValue({ filters: { overall_status: ['MANUAL_REVIEW'] }, described: 'outcome manual review', explanation: '', summary: '1 case match: 1 in manual review.', total: 1,
      rows: [{ id: 3, case_ref: 'CS-20261001-00003', full_name: 'Some Person', submitted_at: '2026-10-01T00:00:00Z', overall_status: 'MANUAL_REVIEW', review_decision: null }] })
    render(<CopilotPanel />)
    expect(await screen.findByText(/AI search is off, so questions in words are not available/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'MANUAL_REVIEW' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(await screen.findByText('1 case match: 1 in manual review.')).toBeTruthy()
    expect(api.askCopilot).toHaveBeenCalledWith({ filters: { overall_status: ['MANUAL_REVIEW'] } })
  })
  it('sends a question in words when AI search is on and shows the filters it used', async () => {
    api.getAiStatus.mockResolvedValue(ON)
    api.askCopilot.mockResolvedValue({ filters: {}, described: 'escalated to compliance', explanation: 'Escalated.', summary: 'No cases match.', total: 0, rows: [] })
    render(<CopilotPanel />)
    fireEvent.change(await screen.findByLabelText('Ask a question'), { target: { value: 'what did I escalate?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
    expect(await screen.findByText(/Searched: escalated to compliance/)).toBeTruthy()
    expect(api.askCopilot).toHaveBeenCalledWith({ question: 'what did I escalate?' })
  })
})
