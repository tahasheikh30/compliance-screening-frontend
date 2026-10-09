import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import { makeSupabase, sessionFor, ME } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))
vi.mock('../api', () => ({
  getMe: vi.fn(async () => ME),
  SESSION_ENDED_EVENT: 'screening:session-ended',
  ACCOUNT_CHANGED_EVENT: 'screening:account-changed',
}))

import { AuthProvider, useAuth } from '../auth/AuthContext'

let auth
function Grab() {
  auth = useAuth()
  return <span data-testid="phase">{auth.phase}</span>
}

async function mountSignedIn() {
  render(<AuthProvider><Grab /></AuthProvider>)
  await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('ready'))
}

beforeEach(() => {
  localStorage.clear()
  h.supabase = makeSupabase({ session: sessionFor() })
})

afterEach(() => cleanup())

describe('changePassword', () => {
  it('checks the current password for this account, then sets the new one', async () => {
    await mountSignedIn()
    await act(async () => { await auth.changePassword('old-password-here', 'brand-new-password', 'tok') })

    expect(h.supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'old-password-here',
      options: { captchaToken: 'tok' },
    })
    expect(h.supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'brand-new-password' })
    const verified = h.supabase.auth.signInWithPassword.mock.invocationCallOrder[0]
    const updated = h.supabase.auth.updateUser.mock.invocationCallOrder[0]
    expect(verified).toBeLessThan(updated)
    expect(screen.getByTestId('phase').textContent).toBe('ready')   // still signed in, no reload or sign out
  })

  it('leaves the password alone when the current one is wrong', async () => {
    await mountSignedIn()
    h.supabase.state.signInError = { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }
    await expect(act(async () => { await auth.changePassword('wrong-password-1', 'brand-new-password') }))
      .rejects.toMatchObject({ message: 'Your current password is not correct.' })
    expect(h.supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('passes on the reason when the new password is refused', async () => {
    await mountSignedIn()
    h.supabase.state.updateError = { code: 'weak_password', status: 422, message: 'Password should be stronger' }
    await expect(act(async () => { await auth.changePassword('old-password-here', 'brand-new-password') }))
      .rejects.toMatchObject({ message: 'That password is not strong enough.' })
  })

  it('does not send a CAPTCHA token when there is none', async () => {
    await mountSignedIn()
    await act(async () => { await auth.changePassword('old-password-here', 'brand-new-password') })
    expect(h.supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'old-password-here' })
  })
})
