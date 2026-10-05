// In dev, Vite's proxy (vite.config.js) forwards /api to localhost:8000.
// In production (Vercel), set VITE_API_BASE_URL to your Render backend URL,
// e.g. https://your-backend.onrender.com (the /api part is added if you leave it out).
import { apiFetch, ApiError } from './lib/apiError'

export { ApiError }

/**
 * The backend's routes all live under /api. A base URL set without it, with a trailing slash, or
 * without https:// is the most common reason a fresh deploy "cannot reach the backend", so tolerate
 * all three. A relative base (like the dev default, /api) is used exactly as given.
 */
export function normalizeBase(raw) {
  let base = String(raw || '').trim()
  if (!base) return '/api'
  if (!base.startsWith('/') && !/^https?:\/\//i.test(base)) base = `https://${base}`
  base = base.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(base) && !/\/api$/i.test(base)) base += '/api'
  return base || '/api'
}

const BASE = normalizeBase(import.meta.env.VITE_API_BASE_URL)

// ---------------------------------------------------------------------------
// Access key
//
// The console is opened with the backend's API_KEY. It is kept in sessionStorage (cleared when the
// tab closes) and sent as X-API-Key on every request, evidence downloads and the NACTA upload included.
// The backend must run with ALLOW_API_KEY_FULL_ACCESS=true for the key to open anything but the
// NACTA upload (see README).
// ---------------------------------------------------------------------------

const KEY_STORAGE = 'screening_api_key'
const LAST_AUTH_ERROR = 'screening_last_auth_error'
export const SIGNED_OUT_EVENT = 'screening:signed-out'

export function getStoredKey() {
  return sessionStorage.getItem(KEY_STORAGE)
}

export function storeKey(key) {
  sessionStorage.setItem(KEY_STORAGE, key)
}

export function clearKey() {
  sessionStorage.removeItem(KEY_STORAGE)
}

/** True when `key` can be sent as an HTTP header value. A pasted smart quote or space makes fetch() throw. */
export function isValidKeyFormat(key) {
  return /^[\x21-\x7E]+$/.test(key)
}

function authHeaders() {
  const key = getStoredKey()
  return key ? { 'X-API-Key': key } : {}
}

// The backend says "Sign in with your account" when it is not set to accept the access key. This
// console has no account sign in, so say what actually needs to change.
function explainKeyProblem(err) {
  if (err instanceof ApiError && err.code === 'API_KEY_NOT_ACCEPTED') {
    err.message = 'The server is not set up to accept the access key for this console.'
    err.hint = 'On the backend (Render), set ALLOW_API_KEY_FULL_ACCESS=true and redeploy, then unlock again.'
  }
  return err
}

// A 401 means the stored key no longer works (rejected, or the backend restarted with no API_KEY).
// API_KEY_NOT_ACCEPTED means the backend stopped accepting keys. Either way the right move is the
// same: drop the key and show the access gate again, carrying the reason so the gate can explain
// what happened instead of silently reappearing.
function handleAuthFailure(err) {
  explainKeyProblem(err)
  if (err instanceof ApiError && (err.status === 401 || err.code === 'API_KEY_NOT_ACCEPTED')) {
    clearKey()
    sessionStorage.setItem(LAST_AUTH_ERROR, JSON.stringify({
      status: err.status, code: err.code, message: err.message, hint: err.hint,
    }))
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
  }
  throw err
}

export function takeLastAuthError() {
  const raw = sessionStorage.getItem(LAST_AUTH_ERROR)
  if (!raw) return null
  sessionStorage.removeItem(LAST_AUTH_ERROR)
  try {
    return new ApiError(JSON.parse(raw))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Resilience: a sleeping server, a brief database hiccup, a dropped connection
//
// The backend runs on a free Render plan, which sleeps when idle and takes up to a minute to wake.
// Reads (GET) are retried a few times on trouble that is clearly temporary. A write is never
// retried: a screening that timed out on our side may still have finished on the server, and a
// second attempt would record the applicant twice.
// ---------------------------------------------------------------------------

const RETRY_DELAYS_MS = [1500, 4000, 8000]
const NOT_TEMPORARY = new Set(['AUTH_NOT_CONFIGURED', 'DATABASE_NOT_CONFIGURED'])

export function isTransient(err) {
  if (!(err instanceof ApiError) || NOT_TEMPORARY.has(err.code)) return false
  return err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT' || [502, 503, 504].includes(err.status)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry(fn, { retries = RETRY_DELAYS_MS.length, onRetry } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) throw err
      const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
      const asked = err.retryAfter ? err.retryAfter * 1000 : 0
      onRetry?.({ attempt: attempt + 1, error: err })
      await sleep(Math.min(Math.max(base, asked), 15000))
    }
  }
}

// When the backend last answered. Render sleeps after about 15 minutes without traffic, so a
// wake-up ping is only needed when we have been quiet for a while.
let lastContact = 0
const AWAKE_WINDOW_MS = 10 * 60 * 1000

/** Make sure the backend is awake (and, with deep, that it can reach its database). Resolves when it is. */
export async function wakeBackend({ deep = false, force = false, onRetry } = {}) {
  if (!force && !deep && Date.now() - lastContact < AWAKE_WINDOW_MS) return
  await withRetry(
    () => apiFetch(`${BASE}/health${deep ? '?deep=true' : ''}`, { timeoutMs: 25000 }),
    { onRetry },
  )
  lastContact = Date.now()
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

async function request(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const attempt = () => apiFetch(`${BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  })
  try {
    const res = method === 'GET' ? await withRetry(attempt) : await attempt()
    lastContact = Date.now()
    return res
  } catch (err) {
    return handleAuthFailure(err)
  }
}

async function apiJson(path, options = {}) {
  const res = await request(path, options)
  if (res.status === 204) return null
  return res.json()
}

// ---------------------------------------------------------------------------
// Access key verification (used by the access gate)
// ---------------------------------------------------------------------------

/**
 * Wake the backend, confirm it can reach its database, then confirm it accepts `key`.
 * Resolves true, or throws an ApiError that says which of those failed. Nothing is stored here.
 */
export async function verifyApiKey(key, { onWaking } = {}) {
  await wakeBackend({ deep: true, force: true, onRetry: onWaking })
  const headers = { 'X-API-Key': key }
  try {
    await apiFetch(`${BASE}/me`, { headers })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // a backend from before /api/me existed: the history list is the lightest call that checks the key
      try {
        await apiFetch(`${BASE}/applicants`, { headers })
      } catch (inner) {
        throw explainKeyProblem(inner)
      }
    } else {
      throw explainKeyProblem(err)
    }
  }
  lastContact = Date.now()
  return true
}

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------

// The backend downloads the sanctions lists live and runs a news search, which
// takes 20 to 40 seconds when the lists are not already cached. Give it room.
export const SCREEN_TIMEOUT_MS = 120000

const MAYBE_FINISHED_HINT = 'The screening may still have finished on the server. Open the History tab and '
  + 'check before running it again, so the applicant is not recorded twice.'

export async function screenApplicant({ full_name, dob, nationality, threshold, cnic, father_name }) {
  const body = { full_name }
  if (dob) body.dob = dob
  if (nationality) body.nationality = nationality
  if (cnic) body.cnic = cnic
  if (father_name) body.father_name = father_name
  if (threshold != null) body.threshold = Number(threshold)

  // Never send the screening to a server that is asleep: if the request then timed out we could not
  // tell whether it ran. If this fails, nothing was sent.
  await wakeBackend()
  try {
    return await apiJson('/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: SCREEN_TIMEOUT_MS,
    })
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR')) {
      err.hint = err.code === 'TIMEOUT' ? `${err.hint || ''} ${MAYBE_FINISHED_HINT}`.trim() : MAYBE_FINISHED_HINT
    }
    throw err
  }
}

export async function listApplicants() {
  return apiJson('/applicants')
}

export async function getApplicant(id) {
  return apiJson(`/applicants/${id}`)
}

export function evidenceUrl(resultId) {
  // Evidence downloads also need the key, so they go through a fetch+blob
  // helper instead of a plain <a href> (a direct link can't carry a header).
  return `${BASE}/evidence/${resultId}`
}

export async function downloadEvidence(resultId, filename) {
  const res = await request(`/evidence/${resultId}`, { timeoutMs: 60000 })
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `evidence_${resultId}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Lists (live downloads, kept in the backend's memory for a while)
// ---------------------------------------------------------------------------

export async function getListsStatus() {
  return apiJson('/admin/lists')
}

// Downloads every list again. Takes as long as a screening's list download.
export async function reloadLists() {
  return apiJson('/admin/refresh', { method: 'POST', timeoutMs: SCREEN_TIMEOUT_MS })
}

// ---------------------------------------------------------------------------
// NACTA Proscribed Persons (Fourth Schedule)
// ---------------------------------------------------------------------------

export async function getNactaStatus() {
  return apiJson('/admin/nacta')
}

// NACTA publishes this list only through a web app, so it is loaded from an exported
// CSV or JSON file. The file is sent as the raw request body, not a multipart form.
export async function uploadNacta(file) {
  return apiJson(`/admin/nacta?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
    timeoutMs: 120000,
  })
}
