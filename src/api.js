// In dev, Vite's proxy (vite.config.js) forwards /api to localhost:8000.
// In production (Vercel), set VITE_API_BASE_URL to your Render backend URL,
// e.g. https://your-backend.onrender.com (the /api part is added if you leave it out).
import { apiFetch, ApiError } from './lib/apiError'
import { config } from './lib/config'
import { getSupabase } from './lib/supabase'
import { beginActivity } from './lib/activity'
import { forget } from './lib/readCache'

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
// Who is calling: the app (its key) and the person (their access token)
//
// Every request carries both:
//   X-API-Key: <VITE_API_KEY>            which app is calling. Not a secret: it is built into the page.
//   Authorization: Bearer <access token> who is using it, from their Supabase sign in. This is what
//                                        protects the data; the backend checks it on every request.
// ---------------------------------------------------------------------------

export const SESSION_ENDED_EVENT = 'screening:session-ended'     // the backend no longer accepts this sign in
export const ACCOUNT_CHANGED_EVENT = 'screening:account-changed'  // approval status changed under us

async function accessToken({ forceRefresh = false } = {}) {
  const { auth } = getSupabase()
  if (forceRefresh) {
    const { data } = await auth.refreshSession()
    return data?.session?.access_token || null
  }
  const { data } = await auth.getSession()     // refreshes a token that is about to expire
  return data?.session?.access_token || null
}

const TOKEN_CODES = new Set(['AUTH_REQUIRED', 'AUTH_INVALID_TOKEN', 'AUTH_TOKEN_EXPIRED', 'AUTH_ACCOUNT_DELETED'])
const isTokenProblem = (err) => err instanceof ApiError && err.status === 401 && TOKEN_CODES.has(err.code)
const isAppKeyProblem = (err) => err instanceof ApiError && err.status === 401
  && (err.code === 'AUTH_MISSING_KEY' || err.code === 'AUTH_INVALID_KEY')

// The app's own key is wrong: nothing the person can fix, and signing them out would not help. Say who can.
function explainAppKeyProblem(err) {
  err.message = 'This app is not set up correctly: the server does not accept its access key.'
  err.hint = 'An administrator needs to check that VITE_API_KEY on the frontend matches APP_API_KEY on the backend, '
    + 'then redeploy the frontend.'
  return err
}

function handleFailure(err) {
  if (isAppKeyProblem(err)) {
    explainAppKeyProblem(err)
  } else if (isTokenProblem(err)) {
    // a fresh token was already tried (see request): this sign in is over
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { code: err.code } }))
  } else if (err instanceof ApiError && err.status === 403 && (err.code === 'ACCOUNT_PENDING' || err.code === 'ACCOUNT_REJECTED' || err.code === 'ACCOUNT_DISABLED')) {
    window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT))
  }
  throw err
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

function isTransient(err) {
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
  const end = beginActivity()
  try {
    await withRetry(
      () => apiFetch(`${BASE}/health${deep ? '?deep=true' : ''}`, { timeoutMs: 25000 }),
      { onRetry },
    )
  } finally {
    end()
  }
  lastContact = Date.now()
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

// `track: false` keeps a call out of the global loader: background polling, and screenings, which
// show their own progress.
async function request(path, { track = true, ...options } = {}) {
  const end = track ? beginActivity() : null
  try {
    return await run(path, options)
  } finally {
    end?.()
  }
}

async function run(path, options) {
  const method = (options.method || 'GET').toUpperCase()
  const send = (token) => apiFetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  const attempt = async () => {
    const token = await accessToken()
    try {
      return await send(token)
    } catch (err) {
      // An expired or revoked token is refused before anything runs, so trying once more with a fresh one is
      // safe even for a write.
      if (isTokenProblem(err)) {
        const fresh = await accessToken({ forceRefresh: true })
        if (fresh && fresh !== token) return send(fresh)
      }
      throw err
    }
  }
  try {
    const res = method === 'GET' ? await withRetry(attempt) : await attempt()
    lastContact = Date.now()
    return res
  } catch (err) {
    return handleFailure(err)
  }
}

async function apiJson(path, options = {}) {
  const res = await request(path, options)
  if (res.status === 204) return null
  return res.json()
}

// ---------------------------------------------------------------------------
// The signed in person, and (for administrators) who has signed up
// ---------------------------------------------------------------------------

/** { id, email, role: 'user' | 'admin', status: 'pending' | 'approved' | 'rejected' | 'disabled' } */
export async function getMe() {
  return apiJson('/me')
}

export async function listUsers(status, { background = false } = {}) {
  return apiJson(`/admin/users${status ? `?status=${encodeURIComponent(status)}` : ''}`, { track: !background })
}

export async function setUserStatus(id, status) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  })
}

/**
 * Delete a person: their sign in account and profile. Their past screenings stay in the history. Needs the
 * backend to have SUPABASE_SERVICE_ROLE_KEY; if it does not, the server says so and Disable still works.
 */
export async function deleteUser(id) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function setUserRole(id, role) {
  return apiJson(`/admin/users/${encodeURIComponent(id)}/role`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
  })
}

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------

// The backend downloads the sanctions lists live and runs a news search, which
// takes 20 to 40 seconds when the lists are not already cached. Give it room.
const SCREEN_TIMEOUT_MS = 120000

const MAYBE_FINISHED_HINT = 'The screening may still have finished on the server. Open the History tab and '
  + 'check before running it again, so the applicant is not recorded twice.'

export async function screenApplicant({ full_name, dob, nationality, threshold, cnic, father_name, province, monitor }) {
  const body = { full_name }
  if (monitor) body.monitor = true         // keep watching this person: screened again whenever a list changes
  if (dob) body.dob = dob
  if (nationality) body.nationality = nationality
  if (cnic) body.cnic = cnic
  if (father_name) body.father_name = father_name
  if (province) body.province = province
  if (threshold != null) body.threshold = Number(threshold)

  // Never send the screening to a server that is asleep: if the request then timed out we could not
  // tell whether it ran. If this fails, nothing was sent.
  await wakeBackend()
  try {
    const result = await apiJson('/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: SCREEN_TIMEOUT_MS,
      track: false,
    })
    forget('history:')      // the new screening is a history row the cached copy does not have
    return result
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR')) {
      err.hint = err.code === 'TIMEOUT' ? `${err.hint || ''} ${MAYBE_FINISHED_HINT}`.trim() : MAYBE_FINISHED_HINT
    }
    throw err
  }
}

// History is always the signed in person's own screenings, administrators included. An administrator reads
// someone else's from the People tab (listUserApplicants). The backend returns at most 200 per request.
export async function listApplicants() {
  return apiJson('/applicants?mine=true&limit=200')
}

// Administrators only: one person's screening history.
export async function listUserApplicants(userId) {
  return apiJson(`/admin/users/${encodeURIComponent(userId)}/applicants?limit=200`)
}

export async function getApplicant(id) {
  return apiJson(`/applicants/${id}`)
}

/** Hand a downloaded response to the browser as a file save. */
async function saveResponse(res, filename) {
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadEvidence(resultId, filename) {
  const res = await request(`/evidence/${resultId}`, { timeoutMs: 60000 })
  await saveResponse(res, filename || `evidence_${resultId}.pdf`)
}

// ---------------------------------------------------------------------------
// Batch screening
//
// The file is sent as the raw request body (not a multipart form). The backend reads it, screens every row in
// the background as an ordinary screening, and the page polls getBatch for progress. A batch is private to the
// person who uploaded it, administrators included.
// ---------------------------------------------------------------------------

const BATCH_UPLOAD_TIMEOUT_MS = 120000

const MAYBE_STARTED_HINT = 'The batch may have started on the server. Open the History tab and check before '
  + 'uploading the file again, so the applicants are not screened twice.'

/** Upload a file and start screening it. Resolves with the batch (status 'running'); poll getBatch for the rest. */
export async function startBatch(file, { threshold, monitor } = {}) {
  const qs = new URLSearchParams({ filename: file.name })
  if (threshold != null) qs.set('threshold', String(Number(threshold)))
  if (monitor) qs.set('monitor', 'true')
  // As for a single screening: never send the file to a server that is asleep, because if the request then
  // timed out we could not tell whether the batch had started. If this fails, nothing was sent.
  await wakeBackend()
  try {
    const out = await apiJson(`/batch?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
      timeoutMs: BATCH_UPLOAD_TIMEOUT_MS,
      track: false,
    })
    forget('history:')
    return out
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR')) {
      err.hint = err.code === 'TIMEOUT' ? `${err.hint || ''} ${MAYBE_STARTED_HINT}`.trim() : MAYBE_STARTED_HINT
    }
    throw err
  }
}

/** Progress and per row results. Reads are retried on a brief outage, so a polling page rides out a hiccup. */
export async function getBatch(id) {
  return apiJson(`/batches/${encodeURIComponent(id)}`, { track: false })
}

/** Stop after the row being screened. Resolves with the batch as it now stands. */
export async function cancelBatch(id) {
  return apiJson(`/batches/${encodeURIComponent(id)}/cancel`, { method: 'POST', track: false })
}

export async function downloadBatchResults(id) {
  const res = await request(`/batches/${encodeURIComponent(id)}/results.xlsx`, { timeoutMs: 60000 })
  await saveResponse(res, `screening-results-${id}.xlsx`)
}

export async function downloadBatchEvidence(id) {
  const res = await request(`/batches/${encodeURIComponent(id)}/evidence.zip`, { timeoutMs: 120000 })
  await saveResponse(res, `evidence-batch-${id}.zip`)
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

// ---------------------------------------------------------------------------
// Politically exposed persons (national and provincial)
// ---------------------------------------------------------------------------

export async function getPepStatus() {
  return apiJson('/admin/pep')
}

// An administrator's own PEP list (CSV, JSON or XML), sent as the raw request body.
export async function uploadPep(file) {
  return apiJson(`/admin/pep?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
    timeoutMs: 120000,
  })
}

export async function deletePepUpload() {
  return apiJson('/admin/pep', { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Continuous monitoring
//
// A screened person can be kept under watch: when a sanctions list changes, they are screened again and any
// NEW potential match becomes an alert. Monitoring is private to the person who ran the screening, an
// administrator included: every call below sees only the signed in person's own screenings and alerts.
// ---------------------------------------------------------------------------

/** { enabled, interval_seconds, monitored_applicants, open_alerts, sources: [{ source, last_checked_at, ... }] } */
export async function getMonitoringStatus({ background = false } = {}) {
  return apiJson('/monitoring/status', { track: !background })
}

/** status: 'open' | 'confirmed' | 'dismissed'. Newest first. */
export async function listAlerts(status = 'open') {
  return apiJson(`/monitoring/alerts?status=${encodeURIComponent(status)}&limit=200`)
}

export async function decideAlert(id, status, note) {
  return apiJson(`/monitoring/alerts/${encodeURIComponent(id)}/decision`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...(note ? { note } : {}) }),
  })
}

/** Start or stop watching a screened person. Starting also checks them against the current lists at once. */
export async function setMonitoring(applicantId, enabled) {
  return apiJson(`/applicants/${encodeURIComponent(applicantId)}/monitoring`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
  })
}
