// Spreads calls across several backends and steers around one that is down.
//
// Every backend serves the same data (it all lives in the database), so any of them can answer any request. The
// balancer takes them in turn, and when one fails it is left alone for a while and the others take its share. With a
// single address it does nothing, so a deployment with one backend behaves exactly as before.

export const COOLDOWN_MS = 30_000

/** "a, b" or an array into a clean list: trimmed, blanks removed, repeats removed. */
export function parseList(raw, normalize = (x) => x) {
  const items = Array.isArray(raw) ? raw : String(raw || '').split(',')
  const out = []
  for (const item of items) {
    const v = String(item).trim()
    if (!v) continue
    const n = normalize(v)
    if (!out.includes(n)) out.push(n)
  }
  return out
}

export function createBalancer(bases, { now = () => Date.now(), cooldownMs = COOLDOWN_MS } = {}) {
  const list = [...bases]
  const downUntil = new Map()
  let turn = 0

  const isDown = (b) => (downUntil.get(b) || 0) > now()

  return {
    get size() { return list.length },
    get all() { return [...list] },
    /** The next backend in turn that is not cooling down. If every one is, the one that recovers first. */
    pick(exclude = []) {
      const open = list.filter((b) => !exclude.includes(b))
      if (!open.length) return null
      for (let i = 0; i < open.length; i += 1) {
        const b = open[(turn + i) % open.length]
        if (!isDown(b)) { turn = (turn + i + 1) % open.length; return b }
      }
      return open.reduce((a, b) => ((downUntil.get(a) || 0) <= (downUntil.get(b) || 0) ? a : b))
    },
    fail(b) { if (list.length > 1) downUntil.set(b, now() + cooldownMs) },
    ok(b) { downUntil.delete(b) },
    isDown,
  }
}
