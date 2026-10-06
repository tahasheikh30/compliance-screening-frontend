import { useEffect, useSyncExternalStore } from 'react'

// A running count of things the person is waiting for (API calls, a tab being fetched). The global
// loader (components/GlobalLoader.jsx) shows while the count is above zero.

let count = 0
const listeners = new Set()

function emit() {
  listeners.forEach((listener) => listener())
}

/** Mark the start of something the person waits for. Call the returned function once it is over. */
export function beginActivity() {
  count += 1
  emit()
  let ended = false
  return () => {
    if (ended) return
    ended = true
    count -= 1
    emit()
  }
}

/** Run an async function and count it as activity until it settles, however it ends. */
export async function trackActivity(fn) {
  const end = beginActivity()
  try {
    return await fn()
  } finally {
    end()
  }
}

/** True while anything is being waited for. */
export function useIsBusy() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => count > 0,
    () => false,
  )
}

/** Counts as activity for as long as the component using it is on screen (used for lazy-loaded tabs). */
export function useActivity() {
  useEffect(() => beginActivity(), [])
}
