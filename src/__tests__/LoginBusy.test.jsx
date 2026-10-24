import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const signIn = vi.fn(() => new Promise(() => {}))      // never answers: the screen stays in its "signing in" state
vi.mock('../auth/AuthContext', () => ({
  MIN_PASSWORD_LENGTH: 12,
  useAuth: () => ({ signIn, signUp: vi.fn(), notice: null, clearNotice: vi.fn() }),
}))
vi.mock('../api', async () => ({ ...(await import('./aiMocks')).aiApi, wakeBackend: vi.fn(() => Promise.resolve()) }))

import LoginScreen from '../pages/LoginScreen'

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('sign in screen while signing in', () => {
  it('says so on the button only, with no second "Signing you in" line on screen', async () => {
    render(<LoginScreen mode="signin" />)
    fireEvent.change(document.getElementById('login-email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(document.getElementById('login-password'), { target: { value: 'a-long-enough-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Signing in...' })).toBeTruthy())
    const line = screen.getByText('Signing you in...')
    expect(line.classList.contains('visually-hidden')).toBe(true)      // still announced to screen readers
    expect(line.getAttribute('role')).toBe('status')
  })
})
