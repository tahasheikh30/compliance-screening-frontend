// Every error that can reach a component is an ApiError, so the UI never
// has to guess what shape `err.message` is. Backend errors carry a stable
// `code` (see backend/app/errors.py) and often a `hint` — this file's job
// is making sure those survive network failures, timeouts, and old/odd
// response bodies too, not just the happy structured-JSON case.
export class ApiError extends Error {
  constructor({ status, code, message, hint, requestId, fields, retryAfter }) {
    super(message || 'Something went wrong')
    this.name = 'ApiError'
    this.status = status ?? null
    this.code = code || 'UNKNOWN'
    this.hint = hint || null
    this.requestId = requestId || null
    this.fields = fields || null
    // Seconds the server asked us to wait (Retry-After), when it said.
    this.retryAfter = Number.isFinite(retryAfter) ? retryAfter : null
  }

  // True for problems worth an automatic "Try again" affordance —
  // transient network/server trouble, not something the user typed wrong.
  get retryable() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.code === 'RATE_LIMITED'
      || (this.status != null && this.status >= 500)
  }
}

async function toApiError(res) {
  const requestId = res.headers.get('X-Request-ID') || null
  const retryAfter = parseInt(res.headers.get('Retry-After') || '', 10)
  let body = null
  try {
    body = await res.json()
  } catch {
    // Body wasn't JSON at all (a proxy's HTML error page, a dead backend
    // behind a CDN, etc.) — still surface *something* useful.
    return new ApiError({
      status: res.status, code: `HTTP_${res.status}`,
      message: `The server returned an unexpected response (HTTP ${res.status}).`,
      hint: 'The backend may be down or misconfigured, or a proxy in front of it returned this instead of the API.',
      requestId, retryAfter,
    })
  }
  const err = body && body.error
  if (err && typeof err === 'object') {
    return new ApiError({
      status: res.status, code: err.code, message: err.message || body.detail,
      hint: err.hint, requestId: err.request_id || requestId, fields: err.fields, retryAfter,
    })
  }
  // Older/plain body shape: {"detail": "..."} or {"detail": [...]}  (FastAPI's
  // default 422 shape, or a backend running before the structured envelope).
  const detail = body && body.detail
  const message = typeof detail === 'string' ? detail
    : Array.isArray(detail) ? detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
    : `Request failed (HTTP ${res.status})`
  return new ApiError({ status: res.status, code: `HTTP_${res.status}`, message, requestId, retryAfter })
}

const DEFAULT_TIMEOUT_MS = 20000

// The backend accepts a caller-supplied X-Request-ID (8 to 64 letters, digits, dot, dash, underscore),
// puts it on every log line and echoes it back. Sending our own means even a request that timed out
// can be found in the server log afterwards.
export function newRequestId() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '')
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/**
 * fetch() with: a timeout (distinguished from "offline" and from a plain
 * server error), consistent ApiError on any non-2xx response, and the
 * request ID threaded through so a 200 can still be correlated with a log
 * line if something about it looks wrong later.
 */
export async function apiFetch(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError({
      code: 'OFFLINE', message: 'Your device appears to be offline.',
      hint: 'Check your internet connection and try again.',
    })
  }

  const requestId = newRequestId()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'X-Request-ID': requestId, ...(init.headers || {}) },
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError({
        code: 'TIMEOUT', message: `The request took longer than ${Math.round(timeoutMs / 1000)}s and was cancelled.`,
        hint: 'The server may be under load, or the lists are slow to download right now. Try again.',
        requestId,
      })
    }
    // fetch() itself throwing (not an HTTP error status) means the request
    // never reached a server: DNS failure, connection refused, CORS
    // rejection, mixed-content block, etc.
    throw new ApiError({
      code: 'NETWORK_ERROR', message: 'Could not reach the backend.',
      hint: 'Check the backend is running and VITE_API_BASE_URL is set correctly (see the frontend README). '
        + 'If this is a fresh deploy, confirm the backend\'s ALLOWED_ORIGINS includes this site\'s URL.',
    })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) throw await toApiError(res)
  return res
}
