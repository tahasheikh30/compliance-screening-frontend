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
const at = (path) => window.history.replaceState(null, '', path)
const here = () => window.location.pathname
const pageTitle = (name) => screen.findByRole('heading', { level: 1, name })

beforeEach(() => {
  localStorage.clear()
  at('/')
  h.supabase = makeSupabase()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('scrollTo', vi.fn())
  mockApi(fetchMock, health)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the public information pages', () => {
  it.each([
    ['/how-it-works', 'One name, every list, one verdict.', 'How it works | Sentinel by Packages'],
    ['/security', 'Applicant data is handled with care.', 'Security | Sentinel by Packages'],
    ['/about', 'Confidence without the theatre.', 'About | Sentinel by Packages'],
  ])('opens %s when the address is typed or bookmarked', async (path, heading, title) => {
    await load()
    at(path)
    render(<App />)
    await pageTitle(heading)
    expect(here()).toBe(path)
    // the title is set once the lazily loaded page has mounted, which can land a moment after its heading
    await waitFor(() => expect(document.title).toBe(title))
  })

  it('is reached from the landing page header, and marks the current page', async () => {
    await load()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Know who you’re dealing with.' })
    const nav = () => screen.getByRole('navigation', { name: 'Primary' })
    fireEvent.click(within(nav()).getByRole('link', { name: 'Security' }))
    await pageTitle('Applicant data is handled with care.')
    expect(here()).toBe('/security')
    expect(within(nav()).getByRole('link', { name: 'Security' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav()).getByRole('link', { name: 'About' }).getAttribute('aria-current')).toBeNull()
    fireEvent.click(within(nav()).getByRole('link', { name: 'About' }))
    await pageTitle('Confidence without the theatre.')
    expect(here()).toBe('/about')
  })

  it('returns to the landing page from the wordmark and keeps the sign in link', async () => {
    await load()
    at('/how-it-works')
    render(<App />)
    await pageTitle('One name, every list, one verdict.')
    // one in the header, one under the page
    const signIn = screen.getAllByRole('link', { name: 'Sign in' })
    expect(signIn).toHaveLength(2)
    signIn.forEach((a) => expect(a.getAttribute('href')).toBe('/sign-in'))
    fireEvent.click(screen.getByRole('link', { name: 'Sentinel by Packages home' }))
    await screen.findByRole('heading', { level: 1, name: 'Know who you’re dealing with.' })
    expect(here()).toBe('/')
  })

  it('can be read with a session too, without being sent to the console', async () => {
    await load()
    at('/about')
    h.supabase = makeSupabase({ session: sessionFor() })
    mockApi(fetchMock, { ...health, 'GET /api/me': ME })
    render(<App />)
    await pageTitle('Confidence without the theatre.')
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull())
    expect(here()).toBe('/about')
  })

  it('makes no request to the server or a third party, and loads only its own images', async () => {
    await load()
    for (const path of ['/how-it-works', '/security', '/about']) {
      cleanup()
      at(path)
      const { container } = render(<App />)
      await screen.findByRole('heading', { level: 1 })
      expect(fetchMock).not.toHaveBeenCalled()
      const external = [...container.querySelectorAll('[src], link[href]')]
        .map((el) => el.getAttribute('src') || el.getAttribute('href'))
        .filter((url) => /^(https?:)?\/\//i.test(url))
      expect(external).toEqual([])
      expect([...container.querySelectorAll('img')].every((i) => i.getAttribute('src').startsWith('/'))).toBe(true)
    }
  })

  it('only claims what the app does', async () => {
    await load()
    at('/how-it-works')
    render(<App />)
    await pageTitle('One name, every list, one verdict.')
    for (const verdict of ['Escalate', 'Review', 'Clear']) {
      expect(screen.getAllByText(verdict).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/never as\s+clear/)).toBeTruthy()
    expect(screen.queryByText(/Identity verified/i)).toBeNull()
  })
})

describe('the about page', () => {
  it('introduces Syed Hyder Ali and the group leadership', async () => {
    await load()
    at('/about')
    render(<App />)
    await pageTitle('Confidence without the theatre.')
    expect(screen.getByRole('heading', { level: 2, name: 'Syed Babar Ali' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Syed Hyder Ali' })).toBeTruthy()
    expect(screen.getByText(/joined Packages Limited in July 1987/)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Faisal Khan' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: 'Courage' })).toBeTruthy()
    // this is the Compliance department's tool: no HR contact in the leadership list
    expect(screen.queryByText('Hadia Tariq')).toBeNull()
    expect(screen.queryByText(/Human Resources/)).toBeNull()
  })

  it('shows initials instead of a broken image when a photo is missing', async () => {
    await load()
    at('/about')
    render(<App />)
    await pageTitle('Confidence without the theatre.')
    fireEvent.error(screen.getByAltText('Syed Hyder Ali'))
    const avatar = await screen.findByRole('img', { name: 'Syed Hyder Ali' })
    expect(avatar.textContent).toBe('SA')
    expect(screen.queryByAltText('Syed Hyder Ali')).toBeNull()
  })

  it('keeps the founder\'s text beside a placeholder when the portrait is missing', async () => {
    await load()
    at('/about')
    render(<App />)
    await pageTitle('Confidence without the theatre.')
    fireEvent.error(screen.getByAltText('Syed Babar Ali'))
    const avatar = await screen.findByRole('img', { name: 'Syed Babar Ali' })
    const profile = avatar.parentElement
    expect(profile.className).toBe('info-profile')
    // photo column first, text column second: the text never lands in the narrow photo column
    expect(profile.children).toHaveLength(2)
    expect(profile.children[0]).toBe(avatar)
    expect(profile.children[1].textContent).toMatch(/Syed Babar Ali was born in Lahore/)
  })

  it('hides an illustration that is not there yet', async () => {
    await load()
    at('/about')
    render(<App />)
    await pageTitle('Confidence without the theatre.')
    fireEvent.error(screen.getByAltText('Packages Group companies'))
    await waitFor(() => expect(screen.queryByAltText('Packages Group companies')).toBeNull())
  })
})
