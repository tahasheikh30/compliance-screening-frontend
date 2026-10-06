import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, render, screen } from '@testing-library/react'
import { json, makeSupabase, sessionFor } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

let activity
let GlobalLoader
let api
let fetchMock

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  h.supabase = makeSupabase({ session: sessionFor('ana@example.com', 'tok-1') })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  activity = await import('../lib/activity')
  GlobalLoader = (await import('../components/GlobalLoader')).default
  api = await import('../api')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const loader = () => screen.queryByRole('progressbar', { name: 'Loading' })
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms) })

describe('global loader', () => {
  it('shows nothing when nothing is loading', () => {
    render(<GlobalLoader />)
    tick(2000)
    expect(loader()).toBeNull()
  })

  it('does not flash for something that finishes quickly', () => {
    render(<GlobalLoader />)
    let end
    act(() => { end = activity.beginActivity() })
    tick(100)
    act(() => end())
    tick(2000)
    expect(loader()).toBeNull()
  })

  it('appears after a short delay while something loads, and stays a moment once shown', () => {
    render(<GlobalLoader />)
    let end
    act(() => { end = activity.beginActivity() })
    expect(loader()).toBeNull()
    tick(300)
    expect(loader()).not.toBeNull()
    expect(screen.getByText('Working...')).toBeTruthy()

    act(() => end())
    tick(200)
    expect(loader()).not.toBeNull() // minimum time on screen, so it does not blink
    tick(600)
    expect(loader()).toBeNull()
  })

  it('keeps running until every overlapping request is done', () => {
    render(<GlobalLoader />)
    let endA
    let endB
    act(() => { endA = activity.beginActivity(); endB = activity.beginActivity() })
    tick(300)
    act(() => endA())
    tick(2000)
    expect(loader()).not.toBeNull()
    act(() => endB())
    tick(2000)
    expect(loader()).toBeNull()
  })

  it('counts an activity only once however many times it is ended', () => {
    render(<GlobalLoader />)
    let endA
    let endB
    act(() => { endA = activity.beginActivity(); endB = activity.beginActivity() })
    act(() => { endA(); endA(); endA() })
    tick(300)
    expect(loader()).not.toBeNull() // B is still running
    act(() => endB())
  })

  it('does not block clicks: the overlay ignores the pointer', () => {
    const css = readFileSync('src/index.css', 'utf8')
    const rule = css.match(/^\.gl \{[^}]*\}/m)?.[0] ?? ''
    expect(rule).toMatch(/pointer-events:\s*none/)
  })
})

describe('what counts as loading in the API layer', () => {
  const busyNow = () => {
    let busy
    function Probe() { busy = activity.useIsBusy(); return null }
    render(<Probe />)
    return () => busy
  }

  it('counts an ordinary request while it is in flight and releases it afterwards, even on failure', async () => {
    vi.useRealTimers()
    const isBusy = busyNow()
    let release
    fetchMock.mockImplementationOnce(() => new Promise((r) => { release = () => r(json([])) }))
    const pending = api.listApplicants()
    await vi.waitFor(() => expect(isBusy()).toBe(true))
    release()
    await pending
    await vi.waitFor(() => expect(isBusy()).toBe(false))

    fetchMock.mockResolvedValueOnce(json({ detail: 'nope', error: { code: 'BAD', message: 'nope' } }, 400))
    await expect(api.getApplicant('x')).rejects.toBeTruthy()
    await vi.waitFor(() => expect(isBusy()).toBe(false))
  })

  it('keeps background polling out of the loader', async () => {
    vi.useRealTimers()
    const isBusy = busyNow()
    let release
    fetchMock.mockImplementationOnce(() => new Promise((r) => { release = () => r(json([])) }))
    const pending = api.listUsers('pending', { background: true })
    await new Promise((r) => setTimeout(r, 30))
    expect(isBusy()).toBe(false)
    release()
    await pending
  })

  it('keeps a screening out of the global loader, since it shows its own progress', async () => {
    vi.useRealTimers()
    const isBusy = busyNow()
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/screen')) {
        await new Promise((r) => setTimeout(r, 40))
        return json({ results: [] })
      }
      return json({})
    })
    const run = api.screenApplicant({ full_name: 'A B' })
    await new Promise((r) => setTimeout(r, 15))
    expect(isBusy()).toBe(false)
    await run
  })
})
