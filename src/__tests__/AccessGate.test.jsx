import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const err = (status, code, message, hint = null) => json({ detail: message, error: { code, message, hint } }, status)

let App
let fetchMock

beforeEach(async () => {
  vi.resetModules()
  sessionStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  App = (await import('../App.jsx')).default
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function submitKey(value) {
  render(<App />)
  fireEvent.change(screen.getByLabelText('Access key'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
}

describe('access gate', () => {
  it('shows the gate until the backend accepts the key, then stores it and opens the console', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(json({ id: null, email: 'api-key', role: 'admin', status: 'approved' }))
    await submitKey('good-key')
    await waitFor(() => expect(screen.getByText('Applicant screening')).toBeTruthy())
    expect(sessionStorage.getItem('screening_api_key')).toBe('good-key')
  })

  it('says the key was rejected and stores nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(err(401, 'AUTH_INVALID_KEY', 'That access key was rejected.'))
    await submitKey('wrong')
    await waitFor(() => expect(screen.getByText('Access key rejected')).toBeTruthy())
    expect(sessionStorage.getItem('screening_api_key')).toBeNull()
  })

  it('tells the admin what to change when the server is not set up for the key', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(err(403, 'API_KEY_NOT_ACCEPTED', 'An access key cannot be used for this request.', 'Sign in with your account.'))
    await submitKey('good-key')
    await waitFor(() => expect(screen.getByText(/ALLOW_API_KEY_FULL_ACCESS=true/)).toBeTruthy())
    expect(sessionStorage.getItem('screening_api_key')).toBeNull()
  })

  it('catches a pasted key with a space before it reaches the network', async () => {
    await submitKey('half of a key')
    await waitFor(() => expect(screen.getByText('That does not look like an access key.')).toBeTruthy())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns to the gate with the reason when a later request is refused', async () => {
    sessionStorage.setItem('screening_api_key', 'old-key')
    fetchMock.mockResolvedValue(err(401, 'AUTH_INVALID_KEY', 'That access key was rejected.'))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    await waitFor(() => expect(screen.getByText('Access key rejected')).toBeTruthy())
    expect(screen.getByLabelText('Access key')).toBeTruthy()
    expect(sessionStorage.getItem('screening_api_key')).toBeNull()
  })
})
