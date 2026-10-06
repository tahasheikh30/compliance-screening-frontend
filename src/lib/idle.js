// Sign out after a period with no activity, in any tab. The session is kept in localStorage so people are
// not asked to sign in again on every visit, which on a shared computer would leave the next person signed
// in. The last activity time is stored too, so a browser reopened after the limit starts signed out.

export const IDLE_LIMIT_MS = 30 * 60 * 1000
const KEY = 'screening-last-activity'
const THROTTLE_MS = 5000

export function touch(now = Date.now()) {
  try { localStorage.setItem(KEY, String(now)) } catch { /* storage blocked: the timer below still works */ }
}

export function clearActivity() {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}

export function idleExpired(now = Date.now(), limit = IDLE_LIMIT_MS) {
  try {
    const last = Number(localStorage.getItem(KEY))
    return Number.isFinite(last) && last > 0 && now - last > limit
  } catch {
    return false
  }
}

/** Calls onIdle once the limit passes with no interaction in any tab. Returns a function that stops watching. */
export function watchActivity(onIdle, { limit = IDLE_LIMIT_MS, checkEvery = 15000 } = {}) {
  let lastWrite = 0
  const mark = () => {
    const now = Date.now()
    if (now - lastWrite < THROTTLE_MS) return
    lastWrite = now
    touch(now)
  }
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
  events.forEach((e) => window.addEventListener(e, mark, { passive: true }))
  mark()
  const timer = setInterval(() => { if (idleExpired(Date.now(), limit)) onIdle() }, checkEvery)
  const onVisible = () => { if (document.visibilityState === 'visible' && idleExpired(Date.now(), limit)) onIdle() }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    events.forEach((e) => window.removeEventListener(e, mark))
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
  }
}
