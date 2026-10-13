import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const leaveWithNotice = vi.fn()
vi.mock('../auth/AuthContext', () => ({
  MIN_PASSWORD_LENGTH: 12,
  useAuth: () => ({ me: { id: 'u1', email: 'ana@example.com', role: 'user', status: 'approved' }, isAdmin: false,
    changePassword: vi.fn(), leaveWithNotice, signOutOthers: vi.fn() }),
}))
vi.mock('../api', () => ({
  getPreferences: vi.fn(), savePreferences: vi.fn(), disableMyAccount: vi.fn(), deleteMyAccount: vi.fn(),
  clearMyHistory: vi.fn(), exportHistory: vi.fn(),
}))

import { ToastProvider, deliveryFor } from '../components/Toaster'
import { PreferencesProvider, withDefaults } from '../lib/preferences'
import SettingsModal from '../components/settings/SettingsModal'
import { setIdleMinutes, idleMinutes, IDLE_CHOICES } from '../lib/idle'
import { summarize, nextStep } from '../lib/status'
import { getPreferences, savePreferences, deleteMyAccount, disableMyAccount } from '../api'

const server = (over = {}) => ({ preferences: withDefaults(over), switchable_sources: ['UKSL', 'PEP', 'ADVERSE_MEDIA'] })

function open() {
  return render(<ToastProvider><PreferencesProvider><SettingsModal onClose={vi.fn()} /></PreferencesProvider></ToastProvider>)
}

beforeEach(() => { getPreferences.mockResolvedValue(server()); savePreferences.mockResolvedValue(server()) })
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear() })

describe('notification delivery', () => {
  const s = { enabled: true, popups: true, categories: { monitoring: false } }
  it('drops a switched off category and keeps others', () => {
    expect(deliveryFor(s, 'info', 'monitoring')).toEqual({ popup: false, keep: false })
    expect(deliveryFor(s, 'info', 'lists')).toEqual({ popup: true, keep: true })
  })
  it('the master switch silences everything except errors', () => {
    const off = { ...s, enabled: false }
    expect(deliveryFor(off, 'success', 'lists').keep).toBe(false)
    expect(deliveryFor(off, 'error', 'lists').keep).toBe(true)
  })
  it('with no settings yet, everything is shown', () => {
    expect(deliveryFor(null, 'info', 'x')).toEqual({ popup: true, keep: true })
  })
})

describe('idle limit', () => {
  it('only accepts the offered choices', () => {
    expect(idleMinutes()).toBe(30)
    setIdleMinutes(10)
    expect(idleMinutes()).toBe(10)
    expect(setIdleMinutes(99)).toBe(30)
    expect(IDLE_CHOICES).toEqual([5, 10, 15, 30])
  })
})

describe('switched off lists in the case', () => {
  it('has its own label and is counted apart from not screened', () => {
    const sum = summarize({ results: [{ source: 'UKSL', status: 'SKIPPED' }] })
    expect(sum.skipped).toBe(1)
    expect(sum.notScreened).toBe(0)
    expect(typeof nextStep).toBe('function')
  })
})

describe('Settings modal', () => {
  it('moves between sections from the sidebar', async () => {
    open()
    await screen.findByRole('heading', { name: 'Account', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }))
    expect(await screen.findByRole('heading', { name: 'Notifications', level: 2 })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Lists/ }))
    expect(await screen.findByRole('heading', { name: 'Lists', level: 2 })).toBeTruthy()
  })

  it('saves a list switched off, and only offers switches for switchable lists', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Lists/ }))
    expect(screen.queryByRole('switch', { name: /United Nations/i })).toBeNull()
    const sw = await screen.findByRole('switch', { name: /Check UK Sanctions List in my screenings/i })
    await waitFor(() => expect(sw.disabled).toBe(false))
    fireEvent.click(sw)
    await waitFor(() => expect(savePreferences).toHaveBeenCalled(), { timeout: 3000 })
    expect(savePreferences.mock.calls.at(-1)[0].lists.off).toContain('UKSL')
  })

  it('does not overwrite saved settings when they could not be loaded', async () => {
    getPreferences.mockRejectedValue(new Error('down'))
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }))
    await screen.findByText(/could not be loaded/i)
    const sw = screen.getAllByRole('switch')[0]
    fireEvent.click(sw)
    await new Promise((r) => setTimeout(r, 800))
    expect(savePreferences).not.toHaveBeenCalled()
  })

  it('deleting the account needs the typed email', async () => {
    deleteMyAccount.mockResolvedValue({ ok: true })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Delete (my )?account/i }))
    const confirm = screen.getAllByRole('button', { name: /Delete (my )?account/i }).at(-1)
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/email/i, { selector: '#delete-confirm-email' }), { target: { value: 'ana@example.com' } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(() => expect(deleteMyAccount).toHaveBeenCalledWith('ana@example.com'))
    await waitFor(() => expect(leaveWithNotice).toHaveBeenCalled())
  })

  it('disabling asks first, then signs out', async () => {
    disableMyAccount.mockResolvedValue({ ok: true })
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Disable (my )?account/i }))
    expect(disableMyAccount).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: /Disable (my )?account|Yes/i }).at(-1))
    await waitFor(() => expect(disableMyAccount).toHaveBeenCalled())
    await waitFor(() => expect(leaveWithNotice).toHaveBeenCalled())
  })
})
