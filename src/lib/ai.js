import { useEffect, useState } from 'react'
import { getAiStatus } from '../api'

// What every signed in person may know about AI search: whether it is on. Shared by every component that shows it,
// fetched once and refreshed when an administrator changes the switch. Nothing here is personal data.
let cached = null
const subscribers = new Set()

export function setAiStatus(status) {
  cached = status
  subscribers.forEach((fn) => fn(status))
}

export function resetAiStatus() {
  cached = null
}

/** The AI status ({ state, available, features, message }) or null until it is known (or if it could not be read). */
export function useAiStatus() {
  const [status, setStatus] = useState(cached)
  useEffect(() => {
    subscribers.add(setStatus)
    let active = true
    getAiStatus().then((s) => { if (active) setAiStatus(s) }).catch(() => {})
    return () => { active = false; subscribers.delete(setStatus) }
  }, [])
  return status
}

/** Is this one AI feature available right now? */
export const aiHas = (status, feature) => !!status?.available && !!status.features?.[feature]
