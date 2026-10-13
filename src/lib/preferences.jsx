import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getPreferences, savePreferences } from '../api'
import { useAuth } from '../auth/AuthContext'
import { useNotifications, useToast } from '../components/Toaster'
import { setIdleMinutes } from './idle'

/**
 * The signed in person's settings (Settings in the profile menu). They are stored on the server, so they follow the
 * person to another browser, and applied here as soon as they are known:
 *
 *   notifications  which messages pop up or are kept (see Toaster)
 *   lists          optional lists their own screenings leave out (the server enforces it; this only shows it)
 *   screening      the threshold and monitoring choice a new screening starts from
 *   security       minutes without activity before sign out (kept in lib/idle)
 *   display        the tab they open on, and how dense the tables are
 *
 * Changing a setting updates the screen at once and saves a moment later. If the save fails the person is told and
 * the setting goes back to what the server has.
 */

/** The match threshold the server uses when none is chosen. */
export const DEFAULT_THRESHOLD = 85

export const DEFAULT_PREFS = {
  notifications: {
    enabled: true,
    popups: true,
    categories: { screening: true, monitoring: true, lists: true, account: true, admin: true },
  },
  lists: { off: [] },
  screening: { threshold: null, monitor_by_default: false },
  security: { idle_minutes: 30 },
  display: { default_tab: 'screen', density: 'comfortable' },
}

const SAVE_DELAY_MS = 500
const Context = createContext(null)

const clone = (x) => JSON.parse(JSON.stringify(x))

/** What the server sent, with anything missing filled from the defaults. */
export function withDefaults(raw) {
  const out = clone(DEFAULT_PREFS)
  for (const [group, values] of Object.entries(raw || {})) {
    if (!(group in out) || typeof values !== 'object' || values === null) continue
    for (const [key, value] of Object.entries(values)) {
      if (key === 'categories' && typeof value === 'object') Object.assign(out[group].categories, value)
      else if (key in out[group]) out[group][key] = value
    }
  }
  return out
}

const NOOP = {
  prefs: DEFAULT_PREFS, switchable: [], loaded: false, loadFailed: false, saving: false, update() {}, reload() {},
}

export function usePreferences() {
  return useContext(Context) || NOOP
}

export function PreferencesProvider({ children }) {
  const { me } = useAuth()
  const toast = useToast()
  const { configure } = useNotifications()
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [switchable, setSwitchable] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)   // the server's copy could not be read: do not save over it
  const failed = useRef(false)
  const saved = useRef(DEFAULT_PREFS)        // what the server last confirmed
  const latest = useRef(DEFAULT_PREFS)
  const timer = useRef(null)
  const active = me?.status === 'approved' ? me.id : null

  const apply = useCallback((next) => {
    latest.current = next
    setPrefs(next)
  }, [])

  // load when a person is signed in and approved; start again from the defaults for the next person
  const load = useCallback(async () => {
    try {
      const out = await getPreferences()
      const next = withDefaults(out.preferences)
      saved.current = next
      apply(next)
      setSwitchable(out.switchable_sources || [])
      failed.current = false
      setLoadFailed(false)
      setLoaded(true)
    } catch {
      /* the app keeps working with the defaults, but changes are not saved until the server's copy has been read:
         saving now would overwrite the person's real settings with defaults */
      failed.current = true
      setLoadFailed(true)
      setLoaded(true)
    }
  }, [apply])

  useEffect(() => {
    clearTimeout(timer.current)
    saved.current = DEFAULT_PREFS
    apply(DEFAULT_PREFS)
    setSwitchable([])
    failed.current = false
    setLoadFailed(false)
    setLoaded(false)
    if (active) load()
    return () => clearTimeout(timer.current)
  }, [active, load, apply])

  // the settings that act outside React
  useEffect(() => { configure(prefs.notifications) }, [prefs.notifications, configure])
  useEffect(() => {
    if (loaded) setIdleMinutes(prefs.security.idle_minutes)
  }, [loaded, prefs.security.idle_minutes])
  useEffect(() => {
    document.documentElement.dataset.density = prefs.display.density === 'compact' ? 'compact' : 'comfortable'
  }, [prefs.display.density])

  const flush = useCallback(async () => {
    const sending = latest.current
    setSaving(true)
    try {
      const out = await savePreferences(sending)
      saved.current = withDefaults(out.preferences)
    } catch (err) {
      apply(saved.current)           // back to what the server has
      toast.error('Settings were not saved', { message: err?.message || 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }, [apply, toast])

  /** update((draft) => { draft.lists.off = [...] }) changes a copy, shows it now and saves it shortly. */
  const update = useCallback((change) => {
    if (failed.current) {
      toast.error('Settings could not be loaded', { message: 'Try again from Settings once the server answers.' })
      return
    }
    const next = clone(latest.current)
    change(next)
    apply(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }, [apply, flush, toast])

  const value = useMemo(
    () => ({ prefs, switchable, loaded, loadFailed, saving, update, reload: load }),
    [prefs, switchable, loaded, loadFailed, saving, update, load],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}
