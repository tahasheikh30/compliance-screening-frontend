import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within, fireEvent } from '@testing-library/react'
import { makeSupabase, mockApi } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

let App
let fetchMock
const at = (path) => window.history.replaceState(null, '', path)

async function load() {
  vi.resetModules()
  vi.stubEnv('VITE_API_KEY', 'test-app-key')
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  App = (await import('../App.jsx')).default
}

beforeEach(() => {
  localStorage.clear()
  h.supabase = makeSupabase()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('scrollTo', vi.fn())
  mockApi(fetchMock, { 'GET /api/health': { status: 'ok' } })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('legal pages', () => {
  for (const [path, title] of [
    ['/privacy', 'Privacy policy'],
    ['/terms', 'Terms of use'],
    ['/cookies', 'Cookie notice'],
    ['/accessibility', 'Accessibility'],
  ]) {
    it(`${path} shows its own page to someone who is signed out, and stays there`, async () => {
      at(path)
      await load()
      render(<App />)
      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy()
      expect(screen.getByText(/Last updated/)).toBeTruthy()
      await waitFor(() => expect(window.location.pathname).toBe(path))
    })
  }

  it('lets the reader move between legal pages without a page load', async () => {
    at('/privacy')
    await load()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })
    const tabs = screen.getByRole('navigation', { name: 'Legal pages' })
    fireEvent.click(within(tabs).getByRole('link', { name: 'Terms of use' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of use' })).toBeTruthy()
    expect(window.location.pathname).toBe('/terms')
  })
})
