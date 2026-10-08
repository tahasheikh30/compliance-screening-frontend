import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { makeSupabase, mockApi, sessionFor, ME } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

let App
let fetchMock

async function load() {
  vi.resetModules()
  vi.stubEnv('VITE_API_KEY', 'test-app-key')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  App = (await import('../App.jsx')).default
}

const health = { 'GET /api/health': { status: 'ok' } }
const SOURCES = ['UNSC', 'OFAC', 'UKSL', 'FIA_REDBOOK', 'NACTA', 'ADVERSE_MEDIA'].map((source) => ({ source, last_checked_at: '2026-10-08T08:00:00+00:00' }))
const status = (over = {}) => ({ enabled: true, interval_seconds: 900, monitored_applicants: 2, open_alerts: 0, sources: SOURCES, ...over })
const alert = (over = {}) => ({
  id: 11, applicant_id: 4, applicant_name: 'Hamza Example', source: 'UNSC', list: 'UN 1267', ref: 'QDi.1',
  matched_name: 'Hamza Exemplar', score: 93, status: 'open', created_at: '2026-10-08T09:00:00+00:00',
  decided_at: null, note: null,
  match: { id: 'QDi.1', primary_name: 'Hamza Exemplar', score: 93, list: 'UN 1267', type: 'Individual' }, ...over,
})
const calls = () => fetchMock.mock.calls.map(([u, i]) => `${(i?.method || 'GET')} ${u}`)

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/sign-in')
  h.supabase = makeSupabase({ session: sessionFor() })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('notification of a new match', () => {
  it('tells the person in the app, puts the count on the Monitoring tab, and opens the alerts', async () => {
    await load()
    mockApi(fetchMock, {
      ...health, 'GET /api/me': ME,
      'GET /api/monitoring/status': status({ open_alerts: 2 }),
      'GET /api/monitoring/alerts': [alert(), alert({ id: 12, applicant_name: 'Second Person' })],
    })
    render(<App />)
    expect(await screen.findByText('2 monitoring alerts need review')).toBeTruthy()
    const tab = screen.getByRole('button', { name: /Monitoring/ })
    expect(within(tab).getByLabelText('2 to review')).toBeTruthy()
    fireEvent.click(tab)
    expect(await screen.findByText('Hamza Example')).toBeTruthy()
    expect(screen.getByText('Second Person')).toBeTruthy()
  })

  it('says nothing when there is nothing to review', async () => {
    await load()
    mockApi(fetchMock, { ...health, 'GET /api/me': ME, 'GET /api/monitoring/status': status() })
    render(<App />)
    await screen.findByText('Applicant screening')
    await waitFor(() => expect(calls()).toContain('GET /api/monitoring/status'))
    expect(screen.queryByText(/monitoring alert/)).toBeNull()
    expect(within(screen.getByRole('button', { name: /Monitoring/ })).queryByLabelText(/to review/)).toBeNull()
  })

  it('does not break the console when the monitoring service is not available', async () => {
    await load()
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })       // /monitoring/status answers 404
    render(<App />)
    expect(await screen.findByText('Applicant screening')).toBeTruthy()
    await waitFor(() => expect(calls()).toContain('GET /api/monitoring/status'))
    expect(screen.getByRole('button', { name: 'Run screening' })).toBeTruthy()
  })
})

describe('the Monitoring tab', () => {
  async function openTab(routes) {
    await load()
    mockApi(fetchMock, { ...health, 'GET /api/me': ME, ...routes })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /Monitoring/ }))
  }

  it('summarises who is watched and explains an empty list', async () => {
    await openTab({ 'GET /api/monitoring/status': status({ monitored_applicants: 0 }), 'GET /api/monitoring/alerts': [] })
    expect(await screen.findByText(/Nobody is being monitored yet/)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/Watching 0 people/)
    expect(screen.getByRole('status').textContent).toMatch(/15 minutes/)
  })

  it('warns when automatic checking is switched off on the server', async () => {
    await openTab({ 'GET /api/monitoring/status': status({ enabled: false }), 'GET /api/monitoring/alerts': [] })
    expect(await screen.findByText(/Automatic checking is switched off/)).toBeTruthy()
  })

  it('records a decision with a note and refreshes the count', async () => {
    let open = [alert()]
    await openTab({
      'GET /api/monitoring/status': () => status({ open_alerts: open.length }),
      'GET /api/monitoring/alerts': (u) => (new URL(u, 'http://x').searchParams.get('status') === 'open' ? open : []),
      'POST /api/monitoring/alerts/11/decision': () => { open = []; return alert({ status: 'dismissed' }) },
    })
    expect(await screen.findByText('Hamza Example')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Different date of birth' } })
    fireEvent.click(screen.getByRole('button', { name: /Dismiss: someone else/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Dismiss: someone else/ })).toBeNull())
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')
    expect(JSON.parse(post[1].body)).toEqual({ status: 'dismissed', note: 'Different date of birth' })
    expect(await screen.findByText(/No alerts to review/)).toBeTruthy()
  })

  it('shows decided alerts under their own filter, with a way to reopen', async () => {
    await openTab({
      'GET /api/monitoring/status': status(),
      'GET /api/monitoring/alerts': (u) => (new URL(u, 'http://x').searchParams.get('status') === 'confirmed'
        ? [alert({ status: 'confirmed', note: 'Same CNIC', decided_at: '2026-10-08T10:00:00+00:00' })] : []),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmed' }))
    expect(await screen.findByText('Confirmed match')).toBeTruthy()
    expect(screen.getByText(/Same CNIC/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy()
  })
})

describe('starting monitoring', () => {
  const screened = {
    applicant_id: 7, full_name: 'Ana Example', overall_status: 'AUTO_CLEAR', results: [], case_ref: 'CS-2026-00007', monitored: true,
  }

  it('sends monitor: true when the box is ticked, and the report offers to stop', async () => {
    await load()
    let sent
    mockApi(fetchMock, {
      ...health, 'GET /api/me': ME, 'GET /api/monitoring/status': status(),
      'POST /api/screen': (u, init) => { sent = JSON.parse(init.body); return screened },
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: 'Ana Example' } })
    fireEvent.click(screen.getByLabelText(/Keep monitoring this person/))
    fireEvent.click(screen.getByRole('button', { name: 'Run screening' }))
    expect(await screen.findByRole('button', { name: 'Stop monitoring' }, { timeout: 4000 })).toBeTruthy()
    expect(sent.monitor).toBe(true)
  })

  it('does not ask for monitoring unless the box is ticked', async () => {
    await load()
    let sent
    mockApi(fetchMock, {
      ...health, 'GET /api/me': ME, 'GET /api/monitoring/status': status(),
      'POST /api/screen': (u, init) => { sent = JSON.parse(init.body); return { ...screened, monitored: false } },
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: 'Ana Example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run screening' }))
    expect(await screen.findByRole('button', { name: 'Start monitoring' }, { timeout: 4000 })).toBeTruthy()
    expect(sent.monitor).toBeUndefined()
  })

  it('starts monitoring later from the report and says when the check finds something at once', async () => {
    await load()
    mockApi(fetchMock, {
      ...health, 'GET /api/me': ME, 'GET /api/monitoring/status': status(),
      'POST /api/screen': { ...screened, monitored: false },
      'POST /api/applicants/7/monitoring': { applicant_id: 7, monitored: true, new_alerts: 1 },
    })
    render(<App />)
    fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: 'Ana Example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run screening' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Start monitoring' }, { timeout: 4000 }))
    expect(await screen.findByText('Possible match found')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stop monitoring' })).toBeTruthy()
  })
})

describe('administrators and history', () => {
  const boss = { ...ME, email: 'boss@example.com', role: 'admin' }
  const people = [
    { id: 'self', email: 'boss@example.com', role: 'admin', status: 'approved', created_at: '2026-09-01T10:00:00Z' },
    { id: 'u2', email: 'ana@example.com', role: 'user', status: 'approved', created_at: '2026-09-10T10:00:00Z' },
  ]
  const row = (id, full_name) => ({ id, full_name, overall_status: 'AUTO_CLEAR', submitted_at: '2026-10-01T10:00:00+00:00' })

  it('keep an own-only History tab and read a person\'s history from People', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor('boss@example.com') })
    mockApi(fetchMock, {
      ...health, 'GET /api/me': boss, 'GET /api/monitoring/status': status(),
      'GET /api/admin/users': people,
      'GET /api/applicants': [row(1, 'Boss Own Screening')],
      'GET /api/admin/users/u2/applicants': [row(2, 'Screened By Ana')],
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'History' }))
    expect(await screen.findByText('Boss Own Screening')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Everyone' })).toBeNull()
    expect(calls().some((c) => c === 'GET /api/applicants?mine=true&limit=200')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /People/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Everyone' }))
    fireEvent.click(await screen.findByRole('button', { name: 'View screenings by ana@example.com' }))
    expect(await screen.findByText('Screened By Ana')).toBeTruthy()
    expect(screen.queryByText('Boss Own Screening')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to People' }))
    expect(await screen.findByRole('heading', { name: 'People' })).toBeTruthy()
    expect(screen.queryByText('Screened By Ana')).toBeNull()
  })
})
