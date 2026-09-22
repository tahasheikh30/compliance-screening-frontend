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
// restarted with no API_KEY at all) — in every case the right move is the
// same: drop it and show the access gate again, with the specific reason
// carried along so the gate can explain what happened instead of just
// silently reappearing.
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

export async function screenApplicant({ full_name, cnic, father_name }) {
  // Screening can involve a live web search (adverse media) — give it real room.
  return apiJson('/screen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, cnic, father_name }),
    timeoutMs: 45000,
  })
}

export async function listApplicants() {
  return apiJson('/applicants')
}

export async function getApplicant(id) {
  return apiJson(`/applicants/${id}`)
}

export function evidenceUrl(resultId) {
  // Evidence downloads also need the key — handled via a fetch+blob helper
  // instead of a plain <a href>, since we can't attach a header to a direct link.
  return `${BASE}/evidence/${resultId}`
}

export async function downloadEvidence(resultId, filename) {
  try {
    const res = await apiFetch(evidenceUrl(resultId), { headers: authHeaders() })
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
// FIA Red Book — edition registry
// ---------------------------------------------------------------------------

export async function listFiaEditions() {
  return apiJson('/admin/fia-redbook/editions')
}

export async function getFiaEdition(id) {
  return apiJson(`/admin/fia-redbook/editions/${id}`)
}

export async function uploadFiaEdition(file, notes, { onProgress } = {}) {
  // Uses XMLHttpRequest instead of fetch purely for upload progress events —
  // fetch has no stable cross-browser upload-progress API yet. Kept separate
  // from apiFetch's timeout/offline handling since XHR needs its own.
  const key = sessionStorage.getItem('screening_api_key')
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    if (notes) form.append('notes', notes)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}/admin/fia-redbook/editions`)
    if (key) xhr.setRequestHeader('X-API-Key', key)
    xhr.timeout = 60000
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      let body = null
      try { body = JSON.parse(xhr.responseText) } catch { /* handled below */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body)
      } else if (body && body.error) {
        const err = new ApiError({
          status: xhr.status, code: body.error.code, message: body.error.message || body.detail,
          hint: body.error.hint, requestId: body.error.request_id || xhr.getResponseHeader('X-Request-ID'),
          fields: body.error.fields,
        })
        if (xhr.status === 401) { sessionStorage.removeItem('screening_api_key'); window.location.reload() }
        reject(err)
      } else {
        reject(new ApiError({ status: xhr.status, code: `HTTP_${xhr.status}`, message: 'Upload failed.' }))
      }
    }
    xhr.onerror = () => reject(new ApiError({
      code: 'NETWORK_ERROR', message: 'Could not reach the backend while uploading.',
      hint: 'Check your connection and that the backend is reachable, then try again.',
    }))
    xhr.ontimeout = () => reject(new ApiError({
      code: 'TIMEOUT', message: 'The upload took too long and was cancelled.',
      hint: 'Large or slow connections can time out — try again, or on a faster connection.',
    }))
    xhr.send(form)
  })
}

export async function deleteFiaEdition(id) {
  return apiJson(`/admin/fia-redbook/editions/${id}`, { method: 'DELETE' })
}

export async function browseFiaEntries(id, { q, cnicOnly, offset = 0, limit = 50 } = {}) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  if (q) params.set('q', q)
  if (cnicOnly) params.set('cnic_only', 'true')
  return apiJson(`/admin/fia-redbook/editions/${id}/entries?${params}`)
}

export async function diffFiaEdition(id) {
  return apiJson(`/admin/fia-redbook/editions/${id}/diff`)
}

export async function activateFiaEdition(id, { confirmReviewed, note } = {}) {
  return apiJson(`/admin/fia-redbook/editions/${id}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm_reviewed: !!confirmReviewed, note: note || null }),
  })
}

export async function checkFiaWebsite() {
  return apiJson('/admin/fia-redbook/check', { method: 'POST', timeoutMs: 30000 })
}

export async function getFiaStatus() {
  return apiJson('/admin/fia-redbook/status')
}

// Returns a blob: URL for one PDF page image (caller must revokeObjectURL when done).
export async function fetchFiaPageImageUrl(editionId, pageNumber) {
  try {
    const res = await apiFetch(`${BASE}/admin/fia-redbook/editions/${editionId}/page/${pageNumber}`, {
      headers: authHeaders(),
    })
    const blob = await res.blob()
    return window.URL.createObjectURL(blob)
  } catch (err) {
    dropKeyOn401(err)
  }
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function listNearMisses(limit = 200) {
  return apiJson(`/admin/near-misses?limit=${limit}`)
}

export async function listAdminActivity(limit = 100) {
  return apiJson(`/admin/activity?limit=${limit}`)
}

export async function refreshList(source) {
  // source: 'unsc' | 'ofac' | 'uksl'
  return apiJson(`/admin/refresh-${source}`, { method: 'POST', timeoutMs: 60000 })
}

export async function refreshAll() {
  return apiJson('/admin/refresh', { method: 'POST', timeoutMs: 90000 })
}
