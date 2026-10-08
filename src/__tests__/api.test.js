import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { json, apiErr, makeSupabase, sessionFor } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

let api
let fetchMock
let events

const listen = (name) => {
  const seen = []
  const fn = (e) => seen.push(e)
  window.addEventListener(name, fn)
  events.push(() => window.removeEventListener(name, fn))
  return seen
}

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_KEY', 'test-app-key')
  events = []
  h.supabase = makeSupabase({ session: sessionFor('ana@example.com', 'tok-1') })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  api = await import('../api')
})

afterEach(() => {
  events.forEach((off) => off())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('normalizeBase', () => {
  it('adds /api, https:// and drops trailing slashes for an absolute backend address', () => {
    expect(api.normalizeBase('https://x.onrender.com')).toBe('https://x.onrender.com/api')
    expect(api.normalizeBase('https://x.onrender.com/')).toBe('https://x.onrender.com/api')
    expect(api.normalizeBase('x.onrender.com')).toBe('https://x.onrender.com/api')
    expect(api.normalizeBase('https://x.onrender.com/api/')).toBe('https://x.onrender.com/api')
    expect(api.normalizeBase('http://localhost:8000')).toBe('http://localhost:8000/api')
  })

  it('uses the dev default when unset and leaves a relative path alone', () => {
    expect(api.normalizeBase('')).toBe('/api')
    expect(api.normalizeBase(undefined)).toBe('/api')
    expect(api.normalizeBase('/api')).toBe('/api')
    expect(api.normalizeBase('/proxy/api/')).toBe('/proxy/api')
  })
})

describe('who is calling', () => {
  it('sends the app key AND the signed in person on every call, plus a request id', async () => {
    fetchMock.mockResolvedValue(json([]))
    await api.listApplicants()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/applicants?mine=true&limit=200')
    expect(init.headers['X-API-Key']).toBe('test-app-key')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(init.headers['X-Request-ID']).toMatch(/^[A-Za-z0-9._-]{8,64}$/)
  })

  it('sends both on the NACTA upload and the evidence download too', async () => {
    fetchMock.mockResolvedValueOnce(json({ records: 3 }))
    await api.uploadNacta(new File(['name\nA'], 'nacta.csv', { type: 'text/csv' }))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/nacta?filename=nacta.csv')
    expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBe('test-app-key')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1')
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('text/csv')

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    fetchMock.mockResolvedValueOnce(new Response('%PDF-1.4', { status: 200 }))
    await api.downloadEvidence(7, 'e.pdf')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/evidence/7')
    expect(fetchMock.mock.calls[1][1].headers['X-API-Key']).toBe('test-app-key')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-1')
  })

  it('wakes the server with no credentials at all (the health check is public)', async () => {
    fetchMock.mockResolvedValue(json({ status: 'ok' }))
    await api.wakeBackend({ force: true })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
    expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBeUndefined()
  })

  it('reads who the person is, and lets administrators list and decide on users', async () => {
    fetchMock.mockImplementation(async () => json({ ok: true }))
    await api.getMe()
    await api.listUsers('pending')
    await api.listUsers()
    await api.setUserStatus('abc-1', 'approved')
    await api.setUserRole('abc-1', 'admin')
    await api.listApplicants()
    await api.listUserApplicants('abc-1')
    const calls = fetchMock.mock.calls.map(([u, i]) => `${i.method || 'GET'} ${u}`)
    expect(calls).toEqual([
      'GET /api/me', 'GET /api/admin/users?status=pending', 'GET /api/admin/users',
      'POST /api/admin/users/abc-1/status', 'POST /api/admin/users/abc-1/role', 'GET /api/applicants?mine=true&limit=200',
      'GET /api/admin/users/abc-1/applicants?limit=200',
    ])
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ status: 'approved' })
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ role: 'admin' })
  })
})

describe('an expired or refused sign in', () => {
  it('refreshes the token and tries once more, even for a write', async () => {
    h.supabase.state.refreshed = sessionFor('ana@example.com', 'tok-2')
    const ended = listen(api.SESSION_ENDED_EVENT)
    fetchMock.mockResolvedValueOnce(json({ status: 'ok' }))
    await api.wakeBackend({ force: true })                       // marks the server as awake, so only /api/screen is sent
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce(apiErr(401, 'AUTH_TOKEN_EXPIRED', 'Your session has expired.'))
      .mockResolvedValueOnce(json({ applicant_id: 9 }))
    await expect(api.screenApplicant({ full_name: 'A B' })).resolves.toEqual({ applicant_id: 9 })
    const posts = fetchMock.mock.calls.filter(([u]) => u === '/api/screen')
    expect(posts).toHaveLength(2)
    expect(posts[0][1].headers.Authorization).toBe('Bearer tok-1')
    expect(posts[1][1].headers.Authorization).toBe('Bearer tok-2')
    expect(ended).toHaveLength(0)
  })

  it('ends the session when a fresh token is refused too', async () => {
    const ended = listen(api.SESSION_ENDED_EVENT)
    h.supabase.state.refreshed = sessionFor('ana@example.com', 'tok-2')
    fetchMock.mockImplementation(async () => apiErr(401, 'AUTH_INVALID_TOKEN', 'That sign in is not valid.'))
    await expect(api.getMe()).rejects.toMatchObject({ status: 401, code: 'AUTH_INVALID_TOKEN' })
    expect(ended).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)       // the first try, and one with the refreshed token
  })

  it('ends the session when there is no token to refresh to', async () => {
    const ended = listen(api.SESSION_ENDED_EVENT)
    h.supabase.state.session = null
    h.supabase.state.refreshed = null
    fetchMock.mockResolvedValue(apiErr(401, 'AUTH_REQUIRED', 'Sign in to continue.'))
    await expect(api.getMe()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(ended).toHaveLength(1)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('does not sign the person out when the APP key is wrong, and says who must fix it', async () => {
    const ended = listen(api.SESSION_ENDED_EVENT)
    fetchMock.mockResolvedValue(apiErr(401, 'AUTH_INVALID_KEY', 'The app\'s access key was rejected.'))
    await expect(api.getMe()).rejects.toMatchObject({
      code: 'AUTH_INVALID_KEY',
      message: expect.stringContaining('not set up correctly'),
      hint: expect.stringContaining('VITE_API_KEY'),
    })
    expect(ended).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tells the app when the approval status changed under it, but not for other refusals', async () => {
    const changed = listen(api.ACCOUNT_CHANGED_EVENT)
    fetchMock.mockResolvedValueOnce(apiErr(403, 'ACCOUNT_REJECTED', 'Your account request was declined.'))
    await expect(api.listApplicants()).rejects.toMatchObject({ code: 'ACCOUNT_REJECTED' })
    expect(changed).toHaveLength(1)
    fetchMock.mockResolvedValueOnce(apiErr(403, 'ADMIN_ONLY', 'Only an administrator can do this.'))
    await expect(api.getListsStatus()).rejects.toMatchObject({ code: 'ADMIN_ONLY' })
    expect(changed).toHaveLength(1)
  })
})

describe('disabling and deleting people', () => {
  it('tells the app when an account was disabled under it', async () => {
    const changed = listen(api.ACCOUNT_CHANGED_EVENT)
    fetchMock.mockResolvedValueOnce(apiErr(403, 'ACCOUNT_DISABLED', 'Your account has been disabled by an administrator.'))
    await expect(api.listApplicants()).rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' })
    expect(changed).toHaveLength(1)
  })

  it('ends the session of someone whose account was deleted', async () => {
    const ended = listen(api.SESSION_ENDED_EVENT)
    fetchMock.mockResolvedValue(apiErr(401, 'AUTH_ACCOUNT_DELETED', 'This account has been deleted.'))
    await expect(api.listApplicants()).rejects.toMatchObject({ code: 'AUTH_ACCOUNT_DELETED' })
    expect(ended.length).toBeGreaterThan(0)
  })

  it('deletes a person with DELETE and the right path', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u 2', email: 'a@b.c', sign_in_removed: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await expect(api.deleteUser('u 2')).resolves.toMatchObject({ sign_in_removed: true })
    const [url, init] = fetchMock.mock.calls.at(-1)
    expect(String(url)).toContain('/admin/users/u%202')
    expect(init.method).toBe('DELETE')
  })
})

describe('retries', () => {
  it('retries a read on a temporary server error and then succeeds', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(apiErr(503, 'DATABASE_UNAVAILABLE', 'down', null, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(apiErr(502, 'HTTP_502', 'bad gateway'))
      .mockResolvedValueOnce(json([{ id: 1 }]))
    const p = api.listApplicants()
    await vi.advanceTimersByTimeAsync(10000)
    await expect(p).resolves.toEqual([{ id: 1 }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry an answer that will not change', async () => {
    fetchMock.mockResolvedValue(apiErr(404, 'NOT_FOUND', 'Applicant not found'))
    await expect(api.getApplicant(9)).rejects.toMatchObject({ status: 404 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after a few attempts and surfaces the error', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => Promise.resolve(apiErr(503, 'DATABASE_UNAVAILABLE', 'down')))
    const p = api.listApplicants()
    const assertion = expect(p).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' })
    await vi.advanceTimersByTimeAsync(60000)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})

describe('screening', () => {
  it('wakes the server first, then posts once', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(json({ applicant_id: 5 }))
    await expect(api.screenApplicant({ full_name: 'A B', threshold: 90 })).resolves.toEqual({ applicant_id: 5 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/screen')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ full_name: 'A B', threshold: 90 })
  })

  it('skips the wake-up call when the server answered a moment ago', async () => {
    fetchMock.mockResolvedValue(json([]))
    await api.listApplicants()
    fetchMock.mockResolvedValueOnce(json({ applicant_id: 6 }))
    await api.screenApplicant({ full_name: 'A B' })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/screen')
  })

  it('never posts to a server that will not wake up', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => Promise.resolve(apiErr(503, 'HTTP_503', 'asleep')))
    const p = api.screenApplicant({ full_name: 'A B' })
    const assertion = expect(p).rejects.toMatchObject({ status: 503 })
    await vi.advanceTimersByTimeAsync(60000)
    await assertion
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/screen')).toBe(false)
  })

  it('does not retry a timed out screening and warns that it may have finished', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(api.screenApplicant({ full_name: 'A B' })).rejects.toMatchObject({
      code: 'TIMEOUT',
      hint: expect.stringContaining('History'),
      requestId: expect.any(String),
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('batch screening', () => {
  const xlsx = () => new File([new Uint8Array(10)], 'applicants.xlsx', { type: '' })

  it('wakes the server, then sends the file as the raw body with the settings in the address', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(json({ id: 3, status: 'running' }, 202))
    const f = xlsx()
    await expect(api.startBatch(f, { threshold: 90, monitor: true })).resolves.toMatchObject({ id: 3 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/batch?filename=applicants.xlsx&threshold=90&monitor=true')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(f)                                  // the file itself, not a multipart form
    expect(init.headers['Content-Type']).toBe('application/octet-stream')
    expect(init.headers['X-API-Key']).toBe('test-app-key')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
  })

  it('leaves the settings out when they are not set, and encodes an awkward file name', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'ok' })).mockResolvedValueOnce(json({ id: 4 }, 202))
    await api.startBatch(new File([new Uint8Array(3)], 'my list & more.csv'))
    expect(fetchMock.mock.calls[1][0]).toBe('/api/batch?filename=my+list+%26+more.csv')
  })

  it('never uploads to a server that will not wake up', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => Promise.resolve(apiErr(503, 'HTTP_503', 'asleep')))
    const assertion = expect(api.startBatch(xlsx())).rejects.toMatchObject({ status: 503 })
    await vi.advanceTimersByTimeAsync(60000)
    await assertion
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/batch'))).toBe(false)
  })

  it('does not retry a timed out upload and warns that the batch may have started', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(api.startBatch(xlsx())).rejects.toMatchObject({ code: 'TIMEOUT', hint: expect.stringContaining('History') })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows the server reason for a refused file', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(apiErr(422, 'BATCH_NO_NAME_COLUMN', 'The file has no Full name column.', 'Put the column names in the first row.'))
    await expect(api.startBatch(xlsx())).rejects.toMatchObject({ status: 422, code: 'BATCH_NO_NAME_COLUMN', hint: 'Put the column names in the first row.' })
  })

  it('polls with a read that rides out a brief outage, and cancels with a post', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(apiErr(503, 'HTTP_503', 'waking'))
      .mockResolvedValueOnce(json({ id: 3, status: 'running', done: 1 }))
    const p = api.getBatch(3)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(p).resolves.toMatchObject({ done: 1 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/batches/3')

    fetchMock.mockResolvedValueOnce(json({ id: 3, status: 'running' }))
    await api.cancelBatch(3)
    const [url, init] = fetchMock.mock.calls.at(-1)
    expect(url).toBe('/api/batches/3/cancel')
    expect(init.method).toBe('POST')
  })

  it('saves the results and the evidence zip under clear names', async () => {
    const saved = []
    const real = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = real(tag)
      if (tag === 'a') { el.click = () => saved.push(el.download) }
      return el
    })
    window.URL.createObjectURL = vi.fn(() => 'blob:x')
    window.URL.revokeObjectURL = vi.fn()
    fetchMock.mockImplementation(async () => new Response(new Blob(['x'])))
    await api.downloadBatchResults(3)
    await api.downloadBatchEvidence(3)
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(['/api/batches/3/results.xlsx', '/api/batches/3/evidence.zip'])
    expect(saved).toEqual(['screening-results-3.xlsx', 'evidence-batch-3.zip'])
    vi.restoreAllMocks()
  })
})
