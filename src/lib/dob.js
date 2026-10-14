/**
 * Date of birth as people write it here: dd/mm/yyyy. The screening form shows and edits that, and sends the server
 * the ISO form (yyyy-mm-dd) it has always taken. A native date input is not used because it shows the browser's own
 * order (mm/dd/yyyy on many computers), which cannot be changed from the page.
 */

const MIN_YEAR = 1900

/** What is typed or pasted, tidied into dd/mm/yyyy as it is typed. Digits alone get their slashes; "1/5/1990" is padded. */
export function maskDob(raw) {
  const text = String(raw || '')
  if (/[^\d]/.test(text)) {
    const parts = text.split(/\D/)
    if (parts.length > 1 && parts[0] !== '') {
      const day = parts[0].slice(0, 2)
      const month = parts[1].slice(0, 2)
      let out = (day.length === 1 ? `0${day}` : day) + '/' + (month.length === 1 && parts.length > 2 ? `0${month}` : month)
      if (parts.length > 2) out += '/' + parts[2].slice(0, 4)
      return out
    }
  }
  const d = text.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

const isoOf = (date) => date.toISOString().slice(0, 10)

/** "25/12/1990" -> "1990-12-25"; null unless it is a real date, not in the future, and not before 1900. */
export function parseDob(text, today = new Date()) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(text || ''))
  if (!m) return null
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  if (year < MIN_YEAR) return null
  const iso = isoOf(date)
  return iso <= isoOf(today) ? iso : null
}

/** Why what is typed cannot be used yet, or null when it is empty or fine. */
export function dobProblem(text, today = new Date()) {
  const t = String(text || '')
  if (!t) return null
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return 'Enter the date as dd/mm/yyyy, for example 25/12/1990.'
  if (parseDob(t, today)) return null
  const year = Number(t.slice(6))
  if (year < MIN_YEAR) return `Check the year: it cannot be before ${MIN_YEAR}.`
  const real = new Date(Date.UTC(year, Number(t.slice(3, 5)) - 1, Number(t.slice(0, 2))))
  if (Number.isNaN(real.getTime()) || real.getUTCDate() !== Number(t.slice(0, 2)) || real.getUTCMonth() !== Number(t.slice(3, 5)) - 1) {
    return 'That date does not exist.'
  }
  return 'The date of birth cannot be in the future.'
}
