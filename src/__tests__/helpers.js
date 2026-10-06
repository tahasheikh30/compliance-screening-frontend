import { vi } from 'vitest'

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

/** An error the way the backend sends it. */
export const apiErr = (status, code, message, hint = null, headers = {}) =>
  json({ detail: message, error: { code, message, hint, request_id: 'req-from-server' } }, status, headers)

export const sessionFor = (email = 'ana@example.com', token = 'tok-1', id = 'u1') =>
  ({ access_token: token, user: { id, email } })

/**
 * A stand in for the Supabase client: a session that sign in and sign out change, with the same events
 * the real client raises. state.signInError / state.signUpSession steer the next call.
 */
export function makeSupabase({ session = null } = {}) {
  const listeners = new Set()
  const state = { session, refreshed: undefined, signInError: null, signUpSession: null, signUpError: null }
  const emit = (event) => listeners.forEach((cb) => cb(event, state.session))
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: state.session } })),
    refreshSession: vi.fn(async () => ({
      data: { session: state.refreshed === undefined ? state.session : state.refreshed }, error: null,
    })),
    signInWithPassword: vi.fn(async ({ email }) => {
      if (state.signInError) return { data: { session: null }, error: state.signInError }
      state.session = sessionFor(email.trim())
      emit('SIGNED_IN')
      return { data: { session: state.session }, error: null }
    }),
    signUp: vi.fn(async () => {
      if (state.signUpError) return { data: { session: null }, error: state.signUpError }
      return { data: { session: state.signUpSession, user: {} }, error: null }
    }),
    signOut: vi.fn(async () => { state.session = null; emit('SIGNED_OUT'); return { error: null } }),
    onAuthStateChange: vi.fn((cb) => {
      listeners.add(cb)
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    }),
  }
  return { auth, state, emit }
}

/** Route fetch by "METHOD /path". A value is sent as JSON; a function gets (url, init) and returns a Response or a value. */
export function mockApi(fetchMock, routes) {
  fetchMock.mockImplementation(async (url, init = {}) => {
    const path = new URL(url, 'http://localhost').pathname
    const key = `${(init.method || 'GET').toUpperCase()} ${path}`
    const handler = routes[key]
    if (handler === undefined) return apiErr(404, 'NOT_FOUND', `no route for ${key}`)
    const out = typeof handler === 'function' ? await handler(url, init) : handler
    return out instanceof Response ? out : json(out)
  })
}

export const ME = { id: 'u1', email: 'ana@example.com', role: 'user', status: 'approved' }
