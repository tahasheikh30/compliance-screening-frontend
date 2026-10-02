export function fmtDateTime(iso) {
  if (!iso) return 'n/a'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(iso) {
  if (!iso) return 'n/a'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtNum(n) {
  return n == null ? 'n/a' : Number(n).toLocaleString('en-GB')
}

export function fmtAge(seconds) {
  if (seconds == null) return 'n/a'
  if (seconds < 90) return `${seconds} s ago`
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`
  return `${Math.round(seconds / 3600)} h ago`
}

// Case reference used on the evidence PDF, e.g. CS-20261002-00012.
// Reopened cases carry it from the backend; this is only a fallback.
export function caseRef(caseData) {
  if (caseData?.case_ref) return caseData.case_ref
  return caseData ? `CS-${String(caseData.applicant_id).padStart(5, '0')}` : ''
}

// Only http(s) links from a news feed are rendered as links.
export function safeUrl(u) {
  try {
    const url = new URL(u)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

// "list dated 30 Sept 2026", "downloaded live", or nothing when the publisher gave no date.
export function listDateLabel(v) {
  if (!v) return null
  const parts = String(v).split(';').map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== 'n/a')
  if (parts.length === 0) return null
  const dated = parts.filter((x) => !Number.isNaN(new Date(x).getTime()))
  if (dated.length > 0) return `list dated ${dated.map(fmtDate).join(', ')}`
  return 'downloaded live'
}

export function plural(n, one, many) {
  return `${fmtNum(n)} ${Number(n) === 1 ? one : many}`
}

// A formatted date, or null when the publisher gave none ("n/a", "Retrieved live", empty).
export function dateOrNull(v) {
  if (!v || String(v).toLowerCase() === 'n/a') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : fmtDate(v)
}
