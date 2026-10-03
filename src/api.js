// In dev, Vite's proxy (vite.config.js) forwards /api to localhost:8000.
// In production (Vercel), set VITE_API_BASE_URL to your Render backend URL,
// e.g. https://your-backend.onrender.com/api
import { apiFetch, ApiError } from './lib/apiError'

export { ApiError }

const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

function authHeaders() {
  const key = sessionStorage.getItem('screening_api_key')
  return key ? { 'X-API-Key': key } : {}
}

// Any 401 means the stored key no longer works (rejected, or the backend
// restarted with no API_KEY at all). In every case the right move is the
// same: drop it and show the access gate again, with the specific reason
// carried along so the gate can explain what happened instead of silently
// reappearing.
function dropKeyOn401(err) {
  if (err instanceof ApiError && err.status === 401) {
    sessionStorage.removeItem('screening_api_key')
    sessionStorage.setItem('screening_last_auth_error', JSON.stringify({ code: err.code, message: err.message }))
    window.location.reload()
  }
  throw err
}

async function apiJson(path, options = {}) {
  try {
    const res = await apiFetch(`${BASE}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    })
    if (res.status === 204) return null
    return await res.json()
  } catch (err) {
    dropKeyOn401(err)
  }
}

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------

// The backend downloads the sanctions lists live and runs a news search, which
// takes 20 to 40 seconds when the lists are not already cached. Give it room.
export const SCREEN_TIMEOUT_MS = 120000

export async function screenApplicant({ full_name, dob, nationality, threshold, cnic, father_name }) {
  const body = { full_name }
  if (dob) body.dob = dob
  if (nationality) body.nationality = nationality
  if (cnic) body.cnic = cnic
  if (father_name) body.father_name = father_name
  if (threshold != null) body.threshold = Number(threshold)
  return apiJson('/screen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: SCREEN_TIMEOUT_MS,
  })
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
  try {
    const res = await apiFetch(evidenceUrl(resultId), { headers: authHeaders(), timeoutMs: 60000 })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `evidence_${resultId}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    dropKeyOn401(err)
  }
}

// ---------------------------------------------------------------------------
// Access key verification (used by the access gate)
// ---------------------------------------------------------------------------

export async function verifyApiKey(key) {
  const res = await apiFetch(`${BASE}/applicants`, { headers: { 'X-API-Key': key } })
  return res.ok
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
  try {
    const res = await apiFetch(`${BASE}/admin/nacta?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
      timeoutMs: 120000,
    })
    return await res.json()
  } catch (err) {
    dropKeyOn401(err)
  }
}
