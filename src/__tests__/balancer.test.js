import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { json, apiErr, makeSupabase, sessionFor } from './helpers'
import { createBalancer, parseList } from '../lib/balancer'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

describe('parseList', () => {
  it('trims, drops blanks and repeats, and normalises each address', () => {
    expect(parseList(' a, b ,,a ,c')).toEqual(['a', 'b', 'c'])
    expect(parseList('x.com, y.com', (v) => `https://${v}/api`)).toEqual(['https://x.com/api', 'https://y.com/api'])
    expect(parseList('')).toEqual([])
    expect(parseList(undefined)).toEqual([])
  })
})

describe('createBalancer', () => {
  it('takes the backends in turn', () => {
    const b = createBalancer(['a', 'b', 'c'])
    expect([b.pick(), b.pick(), b.pick(), b.pick()]).toEqual(['a', 'b', 'c', 'a'])
  })

  it('leaves a failing backend alone for a while, then brings it back', () => {
    let t = 1000
    const b = createBalancer(['a', 'b'], { now: () => t, cooldownMs: 100 })
    b.fail('a')
    expect([b.pick(), b.pick(), b.pick()]).toEqual(['b', 'b', 'b'])
    t += 150
    expect(new Set([b.pick(), b.pick()])).toEqual(new Set(['a', 'b']))
  })

  it('still answers when every backend is failing, with the one that recovers first', () => {
    let t = 0
    const b = createBalancer(['a', 'b'], { now: () => t, cooldownMs: 100 })
    b.fail('a'); t += 10; b.fail('b')
    expect(b.pick()).toBe('a')
  })

  it('does nothing special with one backend', () => {
    const b = createBalancer(['only'])
    b.fail('only')
    expect(b.pick()).toBe('only')
  })

  it('can skip backends already tried', () => {
    const b = createBalancer(['a', 'b'])
    expect(b.pick(['a'])).toBe('b')
    expect(b.pick(['a', 'b'])).toBeNull()
  })
})

describe('the api with several backends', () => {
  let api
  let fetchMock
  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_KEY', 'k')
    vi.stubEnv('VITE_API_BASE_URLS', 'https://one.example.com, https://two.example.com')
    h.supabase = makeSupabase({ session: sessionFor('ana@example.com', 'tok') })
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    api = await import('../api')
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

  const hosts = () => fetchMock.mock.calls.map((c) => new URL(c[0]).host)

  it('spreads reads over the backends', async () => {
    fetchMock.mockImplementation(async () => json({ id: 'u', email: 'ana@example.com', role: 'user', status: 'approved' }))
    await api.getMe(); await api.getMe()
    expect(hosts()).toEqual(['one.example.com', 'two.example.com'])
  })

  it('moves a read to the next backend at once when one is down', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url.includes('one.example.com')) throw new TypeError('Failed to fetch')
      return json({ id: 'u', email: 'ana@example.com', role: 'user', status: 'approved' })
    })
    const me = await api.getMe()
    expect(me.email).toBe('ana@example.com')
    expect(hosts()).toEqual(['one.example.com', 'two.example.com'])
    fetchMock.mockClear()
    await api.getMe()
    expect(hosts()).toEqual(['two.example.com'])      // the failing one is skipped for a while
  })

  it('never repeats a write on another backend', async () => {
    fetchMock.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
    await expect(api.setUserStatus('x', 'approved')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not move on for an answer the server meant (a 403 is not an outage)', async () => {
    fetchMock.mockImplementation(async () => apiErr(403, 'ADMIN_ONLY', 'No'))
    await expect(api.getMe()).rejects.toMatchObject({ status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
