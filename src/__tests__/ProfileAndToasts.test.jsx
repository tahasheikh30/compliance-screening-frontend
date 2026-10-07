import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'

const changePassword = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  MIN_PASSWORD_LENGTH: 12,
  useAuth: () => ({ me: { id: 'u1', email: 'ana@example.com', role: 'user', status: 'approved' }, isAdmin: false, changePassword }),
}))

import { ToastProvider, useToast, useNotifications } from '../components/Toaster'
import ProfileMenu from '../components/ProfileMenu'
import AccountPage from '../pages/console/AccountPage'
import NotificationsPage from '../pages/console/NotificationsPage'

afterEach(() => { cleanup(); vi.clearAllMocks() })

function Probe() {
  const toast = useToast()
  const { unread } = useNotifications()
  return (
    <div>
      <button onClick={() => toast.success('Saved it', { message: 'All good' })}>fire</button>
      <button onClick={() => toast.error('Broke', { to: 'history' })}>fail</button>
      <span data-testid="unread">{unread}</span>
    </div>
  )
}

describe('toasts', () => {
  it('shows a toast, logs it as unread, and can be dismissed', async () => {
    render(<ToastProvider><Probe /></ToastProvider>)
    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByRole('status').textContent).toContain('Saved it')
    expect(screen.getByRole('status').textContent).toContain('All good')
    expect(screen.getByTestId('unread').textContent).toBe('1')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss message' }))
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(screen.getByTestId('unread').textContent).toBe('1')      // dismissing does not mark it read
  })

  it('announces errors as alerts and shows the same message once', () => {
    render(<ToastProvider><Probe /></ToastProvider>)
    fireEvent.click(screen.getByText('fail'))
    fireEvent.click(screen.getByText('fail'))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('does nothing, and does not throw, outside a provider', () => {
    render(<Probe />)
    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByTestId('unread').textContent).toBe('0')
  })

  it('removes itself after its time', async () => {
    vi.useFakeTimers()
    render(<ToastProvider><Probe /></ToastProvider>)
    fireEvent.click(screen.getByText('fire'))
    expect(screen.getByRole('status')).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(4500) })
    expect(screen.queryByRole('status')).toBeNull()
    vi.useRealTimers()
  })
})

describe('ProfileMenu', () => {
  const setup = (over = {}) => {
    const props = { email: 'ana@example.com', isAdmin: false, unread: 0, onAccount: vi.fn(), onNotifications: vi.fn(), onSignOut: vi.fn(), ...over }
    render(<ProfileMenu {...props} />)
    return props
  }

  it('has no red dot when nothing is unread, and shows one with a count when there is', () => {
    setup()
    expect(document.querySelector('.profile-dot')).toBeNull()
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeTruthy()
    cleanup()
    setup({ unread: 3 })
    expect(document.querySelector('.profile-dot')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Account menu, 3 unread notifications' })).toBeTruthy()
    expect(screen.getByLabelText('3 unread').textContent).toBe('3')
  })

  it('opens on hover and closes on Escape', () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Account menu' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    fireEvent.mouseEnter(btn.parentElement)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(btn.parentElement, { key: 'Escape' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens on click for touch and keyboard, and the items run their handlers', () => {
    const p = setup({ isAdmin: true })
    const btn = screen.getByRole('button', { name: 'Account menu' })
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Administrator')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Account' }))
    expect(p.onAccount).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }))
    expect(p.onNotifications).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(p.onSignOut).toHaveBeenCalled()
  })
})

describe('AccountPage', () => {
  const fill = (a, b) => {
    fireEvent.change(document.getElementById('new-password'), { target: { value: a } })
    fireEvent.change(document.getElementById('confirm-password'), { target: { value: b } })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  }

  it('shows who the person is', () => {
    render(<ToastProvider><AccountPage /></ToastProvider>)
    expect(screen.getAllByText('ana@example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText('User').length).toBeGreaterThan(0)
  })

  it('rejects a short password and a mismatch without calling the server', () => {
    render(<ToastProvider><AccountPage /></ToastProvider>)
    fill('short', 'short')
    expect(screen.getByText(/at least 12 characters for the password/)).toBeTruthy()
    fill('a-long-enough-password', 'a-different-password')
    expect(screen.getByText('The two passwords do not match.')).toBeTruthy()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('changes the password, clears the form, and raises a toast', async () => {
    changePassword.mockResolvedValue(undefined)
    render(<ToastProvider><AccountPage /></ToastProvider>)
    fill('a-long-enough-password', 'a-long-enough-password')
    await waitFor(() => expect(screen.getAllByText('Password changed').length).toBeGreaterThan(0))
    expect(changePassword).toHaveBeenCalledWith('a-long-enough-password')
    expect(document.getElementById('new-password').value).toBe('')
    expect(screen.getByText('Your password was changed.')).toBeTruthy()
  })

  it('shows the reason when the change is refused', async () => {
    const { ApiError } = await import('../lib/apiError')
    changePassword.mockRejectedValue(new ApiError({ code: 'SIGN_IN_FAILED', message: 'The new password must be different from your current one.' }))
    render(<ToastProvider><AccountPage /></ToastProvider>)
    fill('a-long-enough-password', 'a-long-enough-password')
    await waitFor(() => expect(screen.getByText('The new password must be different from your current one.')).toBeTruthy())
  })
})

describe('NotificationsPage', () => {
  it('lists notifications, marks them read, and can clear them', async () => {
    const seen = []
    function Show() { const n = useNotifications(); seen.push(n.unread); return null }
    render(<ToastProvider><Probe /><Show /><NotificationsPage onOpen={() => {}} /></ToastProvider>)
    expect(screen.getByText('You are all caught up')).toBeTruthy()
    fireEvent.click(screen.getByText('fail'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open History' })).toBeTruthy())
    await waitFor(() => expect(screen.getByTestId('unread').textContent).toBe('0'))   // opened page marks it read
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByText('You are all caught up')).toBeTruthy()
  })
})
