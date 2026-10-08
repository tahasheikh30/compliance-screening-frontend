// A small in-memory cache of the last answer for each read (history, lists). A tab that is opened again
// shows what it had at once and then refreshes in the background, instead of starting from an empty
// "Loading..." every time (the backend can take a while to answer on a plan that sleeps when idle).
//
// Privacy: memory only, never localStorage or sessionStorage, because history rows are applicant PII.
// The whole cache is emptied when the person signs out or their session ends (see AuthContext).

const store = new Map()

/** The last value remembered under key, or null. */
export function peek(key) {
  return store.has(key) ? store.get(key) : null
}

export function remember(key, value) {
  store.set(key, value)
  return value
}

/** Drop every entry whose key starts with prefix (or all of them when no prefix is given). */
export function forget(prefix = '') {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key)
}
