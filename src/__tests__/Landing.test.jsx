import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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
const at = (path) => window.history.replaceState(null, '', path)
const here = () => window.location.pathname
const heroTitle = () => screen.findByRole('heading', { level: 1, name: 'Know who you’re dealing with.' })

beforeEach(() => {
  localStorage.clear()
  at('/')
  h.supabase = makeSupabase()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('scrollTo', vi.fn())     // jsdom does not implement it
  mockApi(fetchMock, health)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the landing page', () => {
  it('is what a signed out visitor sees at the root, with no sign in form yet', async () => {
    await load()
    render(<App />)
    await heroTitle()
    // one in the header, one under the headline
    const signIn = screen.getAllByRole('link', { name: 'Sign in' })
    expect(signIn).toHaveLength(2)
    signIn.forEach((a) => expect(a.getAttribute('href')).toBe('/sign-in'))
    expect(screen.getByRole('link', { name: 'Request an account' })).toBeTruthy()
    expect(screen.queryByLabelText('Work email')).toBeNull()
  })

  it('makes no request to the server and none to a third party', async () => {
    await load()
    const { container } = render(<App />)
    await heroTitle()
    expect(fetchMock).not.toHaveBeenCalled()
    // the Content Security Policy only allows this site's own files: nothing may LOAD from anywhere else
    // (scripts, images, styles, frames). Links the person clicks to go to another site are not loads.
    const external = [...container.querySelectorAll('[src], link[href]')]
      .map((el) => el.getAttribute('src') || el.getAttribute('href'))
      .filter((url) => /^(https?:)?\/\//i.test(url))
    expect(external).toEqual([])
    expect(container.querySelector('iframe, video, link[rel="stylesheet"]')).toBeNull()
    // the only image is the company logo, served from this site's own files
    const images = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(images.every((src) => src.startsWith('/'))).toBe(true)
  })

  it('opens every link to another site safely: https only, new tab, no opener, no referrer', async () => {
    await load()
    const { container } = render(<App />)
    await heroTitle()
    const links = [...container.querySelectorAll('a[href]')].filter((a) => /^(https?:)?\/\//i.test(a.getAttribute('href')))
    expect(links.length).toBeGreaterThan(0)
    for (const a of links) {
      expect(a.getAttribute('href')).toMatch(/^https:\/\//)
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toContain('noopener')
      expect(a.getAttribute('rel')).toContain('noreferrer')
    }
  })

  it('only claims what the app does', async () => {
    await load()
    render(<App />)
    await heroTitle()
    for (const source of ['UN', 'OFAC', 'UK', 'FIA Red Book', 'NACTA']) {
      expect(screen.getAllByText(new RegExp(source)).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/30 minutes/)).toBeTruthy()
    expect(screen.queryByText(/Identity verified/i)).toBeNull()
    expect(screen.queryByText(/Live workspace/i)).toBeNull()
  })

  it('has working in-page links for each section it lists in the header', async () => {
    await load()
    const { container } = render(<App />)
    await heroTitle()
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    const targets = [...nav.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1))
    expect(targets).toEqual(['how-it-works', 'security', 'about'])
    for (const id of targets) expect(container.querySelector(`#${id}`)).toBeTruthy()
  })

  it('scrolls to the section named in a shared link, once the page exists', async () => {
    await load()
    at('/#security')
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<App />)
    await heroTitle()
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.contexts[0].id).toBe('security')
  })

  it('does not take focus or scroll on a fresh load, so the keyboard starts at the skip link', async () => {
    await load()
    at('/')
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(<App />)
    await heroTitle()
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(document.body)
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#lp-main')
  })

  it('opens the data handling notice', async () => {
    await load()
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', '') }
    render(<App />)
    await heroTitle()
    fireEvent.click(screen.getByRole('button', { name: 'Data handling notice' }))
    expect(await screen.findByRole('heading', { name: 'Data handling notice', hidden: true })).toBeTruthy()
  })
})

describe('moving between the public screens', () => {
  it('Sign in leads to the login form at /sign-in, and Back to overview returns', async () => {
    await load()
    render(<App />)
    await heroTitle()
    fireEvent.click(screen.getAllByRole('link', { name: 'Sign in' })[0])
    expect(await screen.findByLabelText('Work email')).toBeTruthy()
    expect(here()).toBe('/sign-in')
    fireEvent.click(screen.getByRole('link', { name: 'Back to overview' }))
    await heroTitle()
    expect(here()).toBe('/')
    // coming from another screen: back to the top, focus on the content
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
    expect(document.activeElement.id).toBe('lp-main')
  })

  it('Request an account leads to the request form at /request-access', async () => {
    await load()
    render(<App />)
    await heroTitle()
    fireEvent.click(screen.getByRole('link', { name: 'Request an account' }))
    expect(await screen.findByLabelText('Repeat the password')).toBeTruthy()
    expect(here()).toBe('/request-access')
  })

  it('keeps the address in step when switching between sign in and request', async () => {
    await load()
    at('/sign-in')
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Request an account' }))
    expect(await screen.findByLabelText('Repeat the password')).toBeTruthy()
    expect(here()).toBe('/request-access')
    fireEvent.click(screen.getByRole('button', { name: 'I already have an account' }))
    await waitFor(() => expect(screen.queryByLabelText('Repeat the password')).toBeNull())
    expect(here()).toBe('/sign-in')
  })

  it('follows the browser back button', async () => {
    await load()
    render(<App />)
    await heroTitle()
    fireEvent.click(screen.getAllByRole('link', { name: 'Sign in' })[0])
    await screen.findByLabelText('Work email')
    window.history.back()
    await heroTitle()
  })

  it('opens the right screen when the address is typed or bookmarked', async () => {
    await load()
    at('/request-access')
    render(<App />)
    expect(await screen.findByLabelText('Repeat the password')).toBeTruthy()
  })

  it('treats a trailing slash and capitals the same', async () => {
    await load()
    at('/Sign-In/')
    render(<App />)
    expect(await screen.findByLabelText('Work email')).toBeTruthy()
    expect(screen.queryByLabelText('Repeat the password')).toBeNull()
  })

  it('sends an unknown address to the landing page', async () => {
    await load()
    at('/does-not-exist')
    render(<App />)
    await heroTitle()
    await waitFor(() => expect(here()).toBe('/'))
  })
})

describe('with a session', () => {
  it('goes straight to the console, and tidies /sign-in out of the address', async () => {
    await load()
    at('/sign-in')
    h.supabase = makeSupabase({ session: sessionFor() })
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    expect(await screen.findByText('Applicant screening')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: /dealing with/ })).toBeNull()
    await waitFor(() => expect(here()).toBe('/'))
  })

  it('signing in moves the address back to /', async () => {
    await load()
    at('/sign-in')
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Work email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Applicant screening')).toBeTruthy()
    await waitFor(() => expect(here()).toBe('/'))
  })

  it('signing out shows the sign in screen, not the landing page', async () => {
    await load()
    at('/')
    h.supabase = makeSupabase({ session: sessionFor() })
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    await screen.findByText('Applicant screening')
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByLabelText('Work email')).toBeTruthy()
    expect(here()).toBe('/sign-in')
    expect(screen.queryByRole('heading', { level: 1, name: /dealing with/ })).toBeNull()
  })

  it('shows the idle sign out message on a fresh load at the root', async () => {
    await load()
    at('/')
    h.supabase = makeSupabase({ session: sessionFor() })
    localStorage.setItem('screening-last-activity', String(Date.now() - 31 * 60 * 1000))
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    expect(await screen.findByText('You were signed out after 30 minutes of inactivity.')).toBeTruthy()
    expect(here()).toBe('/sign-in')
  })

  it('lets the person leave the sign in screen even while a message is showing', async () => {
    await load()
    at('/')
    h.supabase = makeSupabase({ session: sessionFor() })
    localStorage.setItem('screening-last-activity', String(Date.now() - 31 * 60 * 1000))
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    await screen.findByText('You were signed out after 30 minutes of inactivity.')
    fireEvent.click(screen.getByRole('link', { name: 'Back to overview' }))
    await heroTitle()
    expect(here()).toBe('/')
  })
})
