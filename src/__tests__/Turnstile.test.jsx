import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { makeSupabase, mockApi } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

let App
let fetchMock
let turnstile

// A stand in for Cloudflare's script: the check "passes" at once and hands out a new token each time.
function fakeTurnstile({ autoPass = true } = {}) {
  let n = 0
  const api = {
    render: vi.fn((el, opts) => {
      api.options = opts
      if (autoPass) opts.callback(`cf-token-${++n}`)
      return 'widget-1'
    }),
    reset: vi.fn(() => { if (autoPass) api.options.callback(`cf-token-${++n}`) }),
    remove: vi.fn(),
  }
  return api
}

async function load({ siteKey = '1x00000000000000000000AA' } = {}) {
  vi.resetModules()
  vi.stubEnv('VITE_API_KEY', 'test-app-key')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', siteKey)
  App = (await import('../App.jsx')).default
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/sign-in')
  h.supabase = makeSupabase()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  mockApi(fetchMock, { 'GET /api/health': { status: 'ok' } })
  turnstile = fakeTurnstile()
  window.turnstile = turnstile
})

afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function fill(email = 'ana@example.com', password = 'correct horse battery') {
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } })
}

describe('Turnstile on the sign in screen', () => {
  it('shows no check and sends no token when no site key is set', async () => {
    await load({ siteKey: '' })
    render(<App />)
    await screen.findByLabelText('Work email')
    expect(turnstile.render).not.toHaveBeenCalled()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(h.supabase.auth.signInWithPassword).toHaveBeenCalled())
    expect(h.supabase.auth.signInWithPassword.mock.calls[0][0]).toEqual({ email: 'ana@example.com', password: 'correct horse battery' })
  })

  it('renders the widget with the site key and sends the token with sign in', async () => {
    await load()
    render(<App />)
    await screen.findByLabelText('Work email')
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled())
    expect(turnstile.options.sitekey).toBe('1x00000000000000000000AA')
    fill()
    const button = screen.getByRole('button', { name: 'Sign in' })
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(h.supabase.auth.signInWithPassword).toHaveBeenCalled())
    expect(h.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com', password: 'correct horse battery', options: { captchaToken: 'cf-token-1' },
    })
  })

  it('keeps the button disabled until the check has passed', async () => {
    turnstile = fakeTurnstile({ autoPass: false })
    window.turnstile = turnstile
    await load()
    render(<App />)
    await screen.findByLabelText('Work email')
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled())
    fill()
    const button = screen.getByRole('button', { name: 'Sign in' })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(h.supabase.auth.signInWithPassword).not.toHaveBeenCalled()
    turnstile.options.callback('late-token')
    await waitFor(() => expect(button.disabled).toBe(false))
    turnstile.options['expired-callback']()
    await waitFor(() => expect(button.disabled).toBe(true))
  })

  it('asks for a fresh token after a failed attempt (a token works once)', async () => {
    await load()
    h.supabase.state.signInError = { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }
    render(<App />)
    await screen.findByLabelText('Work email')
    fill()
    const button = screen.getByRole('button', { name: 'Sign in' })
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.click(button)
    expect(await screen.findByText('That email or password is not correct.')).toBeTruthy()
    expect(turnstile.reset).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(h.supabase.auth.signInWithPassword).toHaveBeenCalledTimes(2))
    expect(h.supabase.auth.signInWithPassword.mock.calls[1][0].options.captchaToken).toBe('cf-token-2')
  })

  it('sends the token with a request for an account too', async () => {
    window.history.replaceState(null, '', '/request-access')
    await load()
    render(<App />)
    await screen.findByLabelText('Repeat the password')
    fill('new@example.com', 'correct horse battery')
    fireEvent.change(screen.getByLabelText('Repeat the password'), { target: { value: 'correct horse battery' } })
    const button = screen.getByRole('button', { name: 'Request account' })
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.click(button)
    await waitFor(() => expect(h.supabase.auth.signUp).toHaveBeenCalled())
    const arg = h.supabase.auth.signUp.mock.calls[0][0]
    expect(arg.email).toBe('new@example.com')
    expect(arg.options.captchaToken).toBe('cf-token-1')
    expect(arg.options.emailRedirectTo).toBeTruthy()
  })

  it('explains a rejected check in plain words', async () => {
    await load()
    h.supabase.state.signInError = { code: 'captcha_failed', status: 400, message: 'captcha protection: request disallowed' }
    render(<App />)
    await screen.findByLabelText('Work email')
    fill()
    const button = screen.getByRole('button', { name: 'Sign in' })
    await waitFor(() => expect(button.disabled).toBe(false))
    fireEvent.click(button)
    expect(await screen.findByText('The security check was not accepted.')).toBeTruthy()
  })

  it('says so when the check cannot load', async () => {
    delete window.turnstile
    await load()
    const real = document.head.appendChild.bind(document.head)
    const spy = vi.spyOn(document.head, 'appendChild').mockImplementation((tag) => {
      if (tag.tagName === 'SCRIPT') { setTimeout(() => tag.onerror?.()); return tag }
      return real(tag)
    })
    render(<App />)
    expect(await screen.findByText(/security check could not be loaded/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign in' }).disabled).toBe(true)
    spy.mockRestore()
  })
})
