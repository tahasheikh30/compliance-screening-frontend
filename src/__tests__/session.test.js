import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readConfig, configProblems } from '../lib/config'
import { friendlyAuthError } from '../lib/authErrors'
import { IDLE_LIMIT_MS, clearActivity, idleExpired, touch, watchActivity } from '../lib/idle'

const fakeJwt = (payload) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.y`
const good = { apiKey: 'k', supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'sb_publishable_abc' }

describe('config', () => {
  it('trims values and drops a trailing slash on the project address', () => {
    expect(readConfig({ VITE_API_KEY: ' k \n', VITE_SUPABASE_URL: 'https://abc.supabase.co/', VITE_SUPABASE_PUBLISHABLE_KEY: ' p ' }))
      .toEqual({ apiKey: 'k', supabaseUrl: 'https://abc.supabase.co', supabaseKey: 'p', turnstileSiteKey: '' })
    expect(readConfig({})).toEqual({ apiKey: '', supabaseUrl: '', supabaseKey: '', turnstileSiteKey: '' })
    expect(readConfig({ VITE_TURNSTILE_SITE_KEY: ' 0x4AAA \n' }).turnstileSiteKey).toBe('0x4AAA')
  })

  it('accepts a complete setup', () => {
    expect(configProblems(good)).toEqual([])
    expect(configProblems({ ...good, supabaseUrl: 'http://localhost:54321' })).toEqual([])
  })

  it('names each missing setting', () => {
    const out = configProblems({ apiKey: '', supabaseUrl: '', supabaseKey: '' }).join(' ')
    expect(out).toContain('VITE_API_KEY')
    expect(out).toContain('VITE_SUPABASE_URL')
    expect(out).toContain('VITE_SUPABASE_PUBLISHABLE_KEY')
  })

  it('rejects a project address that is not an https origin', () => {
    expect(configProblems({ ...good, supabaseUrl: 'http://abc.supabase.co' })).toHaveLength(1)
    expect(configProblems({ ...good, supabaseUrl: 'https://abc.supabase.co/rest/v1' })).toHaveLength(1)
    expect(configProblems({ ...good, supabaseUrl: 'abc.supabase.co' })).toHaveLength(1)
  })

  it('refuses a SECRET Supabase key, in either format, because it would be shipped to every visitor', () => {
    expect(configProblems({ ...good, supabaseKey: 'sb_secret_abc123' })[0]).toContain('SECRET')
    expect(configProblems({ ...good, supabaseKey: fakeJwt({ role: 'service_role' }) })[0]).toContain('SECRET')
    expect(configProblems({ ...good, supabaseKey: fakeJwt({ role: 'anon' }) })).toEqual([])
  })
})

describe('friendlyAuthError', () => {
  const msg = (e) => friendlyAuthError(e).message
  it('maps the common cases to plain sentences', () => {
    expect(msg({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' })).toBe('That email or password is not correct.')
    expect(msg({ code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' })).toContain('not confirmed')
    expect(msg({ status: 429, message: 'x' })).toContain('Too many attempts')
    expect(msg({ code: 'over_request_rate_limit', status: 429 })).toContain('Too many attempts')
    expect(msg({ code: 'weak_password', status: 422, message: 'Password should be at least 6 characters' })).toContain('not strong enough')
    expect(msg({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toContain('Could not reach')
  })

  it('never shows the raw message of something it does not recognise', () => {
    const e = friendlyAuthError({ status: 500, code: 'unexpected_failure', message: 'internal detail: db role "authenticator" ...' })
    expect(e.message).toBe('Could not complete that. Please try again.')
    expect(JSON.stringify(e)).not.toContain('authenticator')
  })

  it('does not reveal whether an address has an account', () => {
    expect(msg({ code: 'invalid_credentials', status: 400 })).toBe(msg({ message: 'Invalid login credentials', status: 400 }))
  })
})

describe('idle sign out', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  it('is not expired with no record, or just after activity', () => {
    expect(idleExpired()).toBe(false)
    touch()
    expect(idleExpired()).toBe(false)
  })

  it('expires once the limit has passed, and clearing forgets it', () => {
    touch(Date.now() - IDLE_LIMIT_MS - 1000)
    expect(idleExpired()).toBe(true)
    clearActivity()
    expect(idleExpired()).toBe(false)
  })

  it('calls back after the limit with no interaction, and not while the person is active', () => {
    const onIdle = vi.fn()
    const stop = watchActivity(onIdle, { limit: 60000, checkEvery: 1000 })
    vi.advanceTimersByTime(50000)
    expect(onIdle).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('pointerdown'))          // activity restarts the clock
    vi.advanceTimersByTime(50000)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(20000)
    expect(onIdle).toHaveBeenCalled()
    stop()
  })

  it('counts activity in another tab', () => {
    const onIdle = vi.fn()
    const stop = watchActivity(onIdle, { limit: 60000, checkEvery: 1000 })
    vi.advanceTimersByTime(50000)
    touch()                                                  // what another tab writes
    vi.advanceTimersByTime(50000)
    expect(onIdle).not.toHaveBeenCalled()
    stop()
  })
})
