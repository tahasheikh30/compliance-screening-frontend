// Sign out after a period with no activity, in any tab. The session is kept in localStorage so people are
// not asked to sign in again on every visit, which on a shared computer would leave the next person signed
// in. The last activity time is stored too, so a browser reopened after the limit starts signed out.

export const IDLE_LIMIT_MS = 30 * 60 * 1000      // the policy maximum: a person can choose shorter, never longer
export const IDLE_CHOICES = [5, 10, 15, 30]     // minutes
const KEY = 'screening-last-activity'
const LIMIT_KEY = 'screening-idle-minutes'

/** The minutes of inactivity this person chose in Settings (kept here so a browser reopened after the limit still obeys it). */
export function idleMinutes() {
  try {
    const n = Number(localStorage.getItem(LIMIT_KEY))
    return IDLE_CHOICES.includes(n) ? n : 30
  } catch {
    return 30
  }
}

export function setIdleMinutes(minutes) {
  const n = IDLE_CHOICES.includes(Number(minutes)) ? Number(minutes) : 30
  try { localStorage.setItem(LIMIT_KEY, String(n)) } catch { /* the default applies */ }
  return n
}

export function idleLimitMs() {
  return idleMinutes() * 60 * 1000
}
const THROTTLE_MS = 5000

export function touch(now = Date.now()) {
  try { localStorage.setItem(KEY, String(now)) } catch { /* storage blocked: the timer below still works */ }
}

export function clearActivity() {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}

export function idleExpired(now = Date.now(), limit = idleLimitMs()) {
  try {
    const last = Number(localStorage.getItem(KEY))
    return Number.isFinite(last) && last > 0 && now - last > limit
  } catch {
    return false
  }
}

/** Calls onIdle once the limit passes with no interaction in any tab. Returns a function that stops watching. */
export function watchActivity(onIdle, { limit = idleLimitMs, checkEvery = 15000 } = {}) {
  const limitNow = () => (typeof limit === 'function' ? limit() : limit)      // read each time: Settings can change it while signed in
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
  const timer = setInterval(() => { if (idleExpired(Date.now(), limitNow())) onIdle() }, checkEvery)
  const onVisible = () => { if (document.visibilityState === 'visible' && idleExpired(Date.now(), limitNow())) onIdle() }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    events.forEach((e) => window.removeEventListener(e, mark))
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(timer)
  }
}
