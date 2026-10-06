import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { apiErr, makeSupabase, mockApi, sessionFor, ME } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

let App
let fetchMock

async function load({ env = true } = {}) {
  vi.resetModules()
  vi.stubEnv('VITE_API_KEY', env ? 'test-app-key' : '')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  App = (await import('../App.jsx')).default
}

const health = { 'GET /api/health': { status: 'ok' } }

beforeEach(() => {
  localStorage.clear()
  h.supabase = makeSupabase()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function signIn(email = 'ana@example.com', password = 'correct horse battery') {
  fireEvent.change(await screen.findByLabelText('Work email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('setup', () => {
  it('says exactly what is missing instead of showing a broken login', async () => {
    await load({ env: false })
    render(<App />)
    expect(screen.getByText('This app is not set up yet')).toBeTruthy()
    expect(screen.getByText(/VITE_API_KEY is not set/)).toBeTruthy()
    expect(h.supabase.auth.getSession).not.toHaveBeenCalled()
  })
})

describe('signing in', () => {
  it('shows the login screen when nobody is signed in', async () => {
    await load()
    mockApi(fetchMock, health)
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Screening console/ })).toBeTruthy()
    expect(screen.getByLabelText('Work email')).toBeTruthy()
  })

  it('opens the console for an approved user, sending both credentials, with no People tab', async () => {
    await load()
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    await signIn()
    expect(await screen.findByText('Applicant screening')).toBeTruthy()
    expect(screen.getByText('ana@example.com')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /People/ })).toBeNull()
    const me = fetchMock.mock.calls.find(([u]) => u === '/api/me')
    expect(me[1].headers['X-API-Key']).toBe('test-app-key')
    expect(me[1].headers.Authorization).toBe('Bearer tok-1')
  })

  it('resumes a saved session without asking again', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    expect(await screen.findByText('Applicant screening')).toBeTruthy()
    expect(screen.queryByLabelText('Work email')).toBeNull()
  })

  it('gives a plain message for a wrong password and stays on the login screen', async () => {
    await load()
    h.supabase.state.signInError = { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }
    mockApi(fetchMock, health)
    render(<App />)
    await signIn('ana@example.com', 'wrong password here')
    expect(await screen.findByText('That email or password is not correct.')).toBeTruthy()
    expect(screen.getByLabelText('Work email')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/me')).toBe(false)
  })

  it('does not call Supabase at all when the form is incomplete', async () => {
    await load()
    mockApi(fetchMock, health)
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your email address.')).toBeTruthy()
    expect(h.supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })
})

describe('requesting an account', () => {
  async function openSignup() {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Request an account' }))
  }
  const fill = (email, password, repeat) => {
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: email } })
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } })
    fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: repeat } })
    fireEvent.click(screen.getByRole('button', { name: 'Request account' }))
  }

  it('rejects a short password and a mismatch before any request is made', async () => {
    await load()
    mockApi(fetchMock, health)
    await openSignup()
    fill('new@example.com', 'short', 'short')
    expect(await screen.findByText(/at least 12 characters for the password/)).toBeTruthy()
    fill('new@example.com', 'a long enough passphrase', 'a different passphrase')
    expect(await screen.findByText('The two passwords do not match.')).toBeTruthy()
    expect(h.supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('tells the person to confirm their email when Supabase asks for it', async () => {
    await load()
    mockApi(fetchMock, health)
    await openSignup()
    fill('new@example.com', 'a long enough passphrase', 'a long enough passphrase')
    expect(await screen.findByText('Request received')).toBeTruthy()
    expect(screen.getByText(/open the confirmation link/)).toBeTruthy()
    expect(h.supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com' }))
  })

  it('goes straight to waiting for approval when no email confirmation is needed', async () => {
    await load()
    h.supabase.state.signUpSession = sessionFor('new@example.com')
    mockApi(fetchMock, health)
    await openSignup()
    fill('new@example.com', 'a long enough passphrase', 'a long enough passphrase')
    expect(await screen.findByText(/waiting for an administrator to approve it/)).toBeTruthy()
  })
})

describe('approval', () => {
  it('holds a pending person on the waiting screen until an administrator approves them', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    let status = 'pending'
    mockApi(fetchMock, { ...health, 'GET /api/me': () => ({ ...ME, status }) })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Waiting for approval' })).toBeTruthy()
    expect(screen.queryByText('Applicant screening')).toBeNull()
    status = 'approved'
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText('Applicant screening')).toBeTruthy()
  })

  it('tells a declined person so, with no way to retry', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    mockApi(fetchMock, { ...health, 'GET /api/me': { ...ME, status: 'rejected' } })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Request declined' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull()
  })

  it('moves a signed in user to the waiting screen when the server says their access was withdrawn', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    let status = 'approved'
    mockApi(fetchMock, {
      ...health,
      'GET /api/me': () => ({ ...ME, status }),
      'GET /api/applicants': () => (status === 'approved' ? [] : apiErr(403, 'ACCOUNT_REJECTED', 'Your account request was declined.')),
    })
    render(<App />)
    await screen.findByText('Applicant screening')
    status = 'rejected'
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(await screen.findByRole('heading', { name: 'Request declined' })).toBeTruthy()
  })
})

describe('administrators', () => {
  it('see a People tab with how many are waiting', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor('boss@example.com') })
    mockApi(fetchMock, {
      ...health,
      'GET /api/me': { ...ME, email: 'boss@example.com', role: 'admin' },
      'GET /api/admin/users': [
        { id: 'p1', email: 'a@example.com', role: 'user', status: 'pending', created_at: '2026-10-01T10:00:00Z' },
        { id: 'p2', email: 'b@example.com', role: 'user', status: 'pending', created_at: '2026-10-02T10:00:00Z' },
      ],
    })
    render(<App />)
    const tab = await screen.findByRole('button', { name: /People/ })
    await waitFor(() => expect(within(tab).getByLabelText('2 waiting')).toBeTruthy())
    expect(screen.getByText('Administrator')).toBeTruthy()
  })
})

describe('leaving', () => {
  it('signs out from the header', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    await screen.findByText('Applicant screening')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByLabelText('Work email')).toBeTruthy()
    expect(h.supabase.auth.signOut).toHaveBeenCalled()
  })

  it('returns to the login screen, with the reason, when the backend ends the session', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    h.supabase.state.refreshed = null
    let signedIn = true
    mockApi(fetchMock, {
      ...health,
      'GET /api/me': ME,
      'GET /api/applicants': () => (signedIn ? [] : apiErr(401, 'AUTH_INVALID_TOKEN', 'That sign in is not valid.')),
    })
    render(<App />)
    await screen.findByText('Applicant screening')
    signedIn = false
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(await screen.findByText('Your session has ended. Please sign in again.')).toBeTruthy()
    expect(screen.getByLabelText('Work email')).toBeTruthy()
  })

  it('signs out a browser that was left idle past the limit', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    localStorage.setItem('screening-last-activity', String(Date.now() - 31 * 60 * 1000))
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    expect(await screen.findByText('You were signed out after 30 minutes of inactivity.')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([u]) => u === '/api/me')).toBe(false)
  })
})

describe('when the backend cannot be reached or is misconfigured', () => {
  it('keeps the person signed in and explains a wrong app key, without a sign out', async () => {
    await load()
    h.supabase = makeSupabase({ session: sessionFor() })
    mockApi(fetchMock, { ...health, 'GET /api/me': () => apiErr(401, 'AUTH_INVALID_KEY', 'The app\'s access key was rejected.') })
    render(<App />)
    expect(await screen.findByText('App not set up correctly')).toBeTruthy()
    expect(screen.getByText(/VITE_API_KEY on the frontend matches APP_API_KEY/)).toBeTruthy()
    expect(h.supabase.auth.signOut).not.toHaveBeenCalled()
  })
})
