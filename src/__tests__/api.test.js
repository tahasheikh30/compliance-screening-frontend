import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const apiError = (status, code, message, hint = null, headers = {}) =>
  json({ detail: message, error: { code, message, hint, request_id: 'req-from-server' } }, status, headers)

let api
let fetchMock

beforeEach(async () => {
  vi.resetModules()
  sessionStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  api = await import('../api')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
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

describe('isValidKeyFormat', () => {
  it('rejects anything that cannot be an HTTP header value', () => {
    expect(api.isValidKeyFormat('abc-DEF_123.xyz~')).toBe(true)
    expect(api.isValidKeyFormat('has space')).toBe(false)
    expect(api.isValidKeyFormat('line\nbreak')).toBe(false)
    expect(api.isValidKeyFormat('smart\u201Cquote')).toBe(false)
  })
})

describe('sending the access key', () => {
  it('sends X-API-Key and a request id on every call', async () => {
    api.storeKey('secret-key')
    fetchMock.mockResolvedValue(json([]))
    await api.listApplicants()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/applicants')
    expect(init.headers['X-API-Key']).toBe('secret-key')
    expect(init.headers['X-Request-ID']).toMatch(/^[A-Za-z0-9._-]{8,64}$/)
  })

  it('sends the key on the NACTA upload and the evidence download too', async () => {
    api.storeKey('secret-key')
    fetchMock.mockResolvedValueOnce(json({ records: 3 }))
    await api.uploadNacta(new File(['name\nA'], 'nacta.csv', { type: 'text/csv' }))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/nacta?filename=nacta.csv')
    expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBe('secret-key')
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('text/csv')

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    fetchMock.mockResolvedValueOnce(new Response('%PDF-1.4', { status: 200 }))
    await api.downloadEvidence(7, 'e.pdf')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/evidence/7')
    expect(fetchMock.mock.calls[1][1].headers['X-API-Key']).toBe('secret-key')
  })
})

describe('verifyApiKey', () => {
  it('wakes the backend, checks the database, then checks the key against /me', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(json({ id: null, email: 'api-key', role: 'admin', status: 'approved' }))
    await expect(api.verifyApiKey('k1')).resolves.toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health?deep=true')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/me')
    expect(fetchMock.mock.calls[1][1].headers['X-API-Key']).toBe('k1')
  })

  it('falls back to the history list on a backend that has no /api/me', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(apiError(404, 'NOT_FOUND', 'That endpoint does not exist.'))
      .mockResolvedValueOnce(json([]))
    await expect(api.verifyApiKey('k1')).resolves.toBe(true)
    expect(fetchMock.mock.calls[2][0]).toBe('/api/applicants')
  })

  it('reports a wrong key as a rejected key', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(apiError(401, 'AUTH_INVALID_KEY', 'That access key was rejected.'))
    await expect(api.verifyApiKey('bad')).rejects.toMatchObject({ status: 401, code: 'AUTH_INVALID_KEY' })
  })

  it('explains what to change when the backend is not set to accept the key', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(apiError(403, 'API_KEY_NOT_ACCEPTED', 'An access key cannot be used for this request.', 'Sign in with your account.'))
    await expect(api.verifyApiKey('k1')).rejects.toMatchObject({
      code: 'API_KEY_NOT_ACCEPTED',
      hint: expect.stringContaining('ALLOW_API_KEY_FULL_ACCESS=true'),
    })
  })

  it('tells the user when the database cannot be reached instead of unlocking', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(() => Promise.resolve(
      apiError(503, 'DATABASE_UNAVAILABLE', 'The database cannot be reached right now.', null, { 'Retry-After': '1' })))
    const p = api.verifyApiKey('k1')
    const assertion = expect(p).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' })
    await vi.advanceTimersByTimeAsync(60000)
    await assertion
    expect(fetchMock.mock.calls.every(([url]) => url === '/api/health?deep=true')).toBe(true)
  })

  it('reports a sleeping server through onWaking and succeeds once it answers', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(apiError(503, 'HTTP_503', 'Service unavailable'))
      .mockResolvedValueOnce(json({ status: 'ok' }))
      .mockResolvedValueOnce(json({ id: null, email: 'api-key', role: 'admin', status: 'approved' }))
    const onWaking = vi.fn()
    const p = api.verifyApiKey('k1', { onWaking })
    await vi.advanceTimersByTimeAsync(5000)
    await expect(p).resolves.toBe(true)
    expect(onWaking).toHaveBeenCalledTimes(1)
  })
})

describe('retries', () => {
  it('retries a read on a temporary server error and then succeeds', async () => {
    vi.useFakeTimers()
    api.storeKey('k')
    fetchMock
      .mockResolvedValueOnce(apiError(503, 'DATABASE_UNAVAILABLE', 'down', null, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(apiError(502, 'HTTP_502', 'bad gateway'))
      .mockResolvedValueOnce(json([{ id: 1 }]))
    const p = api.listApplicants()
    await vi.advanceTimersByTimeAsync(10000)
    await expect(p).resolves.toEqual([{ id: 1 }])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry an answer that will not change', async () => {
    api.storeKey('k')
    fetchMock.mockResolvedValue(apiError(404, 'NOT_FOUND', 'Applicant not found'))
    await expect(api.getApplicant(9)).rejects.toMatchObject({ status: 404 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after a few attempts and surfaces the error', async () => {
    vi.useFakeTimers()
    api.storeKey('k')
    fetchMock.mockImplementation(() => Promise.resolve(apiError(503, 'DATABASE_UNAVAILABLE', 'down')))
    const p = api.listApplicants()
    const assertion = expect(p).rejects.toMatchObject({ code: 'DATABASE_UNAVAILABLE' })
    await vi.advanceTimersByTimeAsync(60000)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})

describe('screening', () => {
  it('wakes the server first, then posts once', async () => {
    api.storeKey('k')
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
    api.storeKey('k')
    fetchMock.mockResolvedValue(json([]))
    await api.listApplicants()
    fetchMock.mockResolvedValueOnce(json({ applicant_id: 6 }))
    await api.screenApplicant({ full_name: 'A B' })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/screen')
  })

  it('never posts to a server that will not wake up', async () => {
    vi.useFakeTimers()
    api.storeKey('k')
    fetchMock.mockImplementation(() => Promise.resolve(apiError(503, 'HTTP_503', 'asleep')))
    const p = api.screenApplicant({ full_name: 'A B' })
    const assertion = expect(p).rejects.toMatchObject({ status: 503 })
    await vi.advanceTimersByTimeAsync(60000)
    await assertion
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/screen')).toBe(false)
  })

  it('does not retry a timed out screening and warns that it may have finished', async () => {
    api.storeKey('k')
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

describe('a key the backend refuses', () => {
  it('drops the key, signs out and remembers why on a 401', async () => {
    api.storeKey('stale')
    const signedOut = vi.fn()
    window.addEventListener(api.SIGNED_OUT_EVENT, signedOut)
    fetchMock.mockResolvedValue(apiError(401, 'AUTH_INVALID_KEY', 'That access key was rejected.'))
    await expect(api.listApplicants()).rejects.toMatchObject({ status: 401 })
    window.removeEventListener(api.SIGNED_OUT_EVENT, signedOut)
    expect(api.getStoredKey()).toBeNull()
    expect(signedOut).toHaveBeenCalledTimes(1)
    expect(api.takeLastAuthError()).toMatchObject({ code: 'AUTH_INVALID_KEY' })
    expect(api.takeLastAuthError()).toBeNull()
  })

  it('signs out when the backend stops accepting keys mid session', async () => {
    api.storeKey('k')
    fetchMock.mockResolvedValue(apiError(403, 'API_KEY_NOT_ACCEPTED', 'An access key cannot be used for this request.'))
    await expect(api.getListsStatus()).rejects.toMatchObject({ code: 'API_KEY_NOT_ACCEPTED' })
    expect(api.getStoredKey()).toBeNull()
    expect(api.takeLastAuthError().hint).toContain('ALLOW_API_KEY_FULL_ACCESS=true')
  })

  it('keeps the key on an ordinary forbidden answer', async () => {
    api.storeKey('k')
    fetchMock.mockResolvedValue(apiError(403, 'ADMIN_ONLY', 'Only an administrator can do this.'))
    await expect(api.reloadLists()).rejects.toMatchObject({ code: 'ADMIN_ONLY' })
    expect(api.getStoredKey()).toBe('k')
  })
})
