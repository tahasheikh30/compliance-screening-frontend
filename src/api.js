// In dev, Vite's proxy (vite.config.js) forwards /api to localhost:8000.
// In production (Vercel), set VITE_API_BASE_URL to your Render backend URL,
// e.g. https://your-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_BASE_URL || '/api'

function authHeaders() {
  const key = sessionStorage.getItem('screening_api_key')
  return key ? { 'X-API-Key': key } : {}
}

async function handle(res) {
  if (res.status === 401) {
    sessionStorage.removeItem('screening_api_key')
    window.location.reload()
    throw new Error('Access key rejected')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed (${res.status})`)
  }
  return res.json()
}

export async function screenApplicant({ full_name, cnic, father_name }) {
  const res = await fetch(`${BASE}/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ full_name, cnic, father_name }),
  })
  return handle(res)
}

export async function listApplicants() {
  const res = await fetch(`${BASE}/applicants`, { headers: authHeaders() })
  return handle(res)
}

export function evidenceUrl(resultId) {
  // Evidence downloads also need the key — handled via a fetch+blob helper
  // instead of a plain <a href>, since we can't attach a header to a direct link.
  return `${BASE}/evidence/${resultId}`
}

export async function downloadEvidence(resultId, filename) {
  const res = await fetch(evidenceUrl(resultId), { headers: authHeaders() })
  if (!res.ok) throw new Error('Could not download evidence file')
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
