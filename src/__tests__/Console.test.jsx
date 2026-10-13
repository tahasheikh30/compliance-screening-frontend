import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

const auth = vi.hoisted(() => ({ me: { id: 'u1', email: 'ana@example.com', role: 'admin', status: 'approved' }, isAdmin: true }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ ...auth, signOut: vi.fn() }) }))
vi.mock('../api', () => ({
  getMonitoringStatus: vi.fn().mockResolvedValue({ open_alerts: 0 }),
  listUsers: vi.fn().mockResolvedValue([]),
}))
// the tab screens are tested on their own; here each one is just a heading
vi.mock('../pages/console/ScreeningTab', () => ({ default: () => <h1>Screening screen</h1> }))
vi.mock('../pages/console/HistoryTab', () => ({ default: () => <h1>History screen</h1> }))
vi.mock('../pages/console/MonitoringTab', () => ({ default: () => <h1>Monitoring screen</h1> }))
vi.mock('../pages/console/ListsTab', () => ({ default: () => <h1>Lists screen</h1> }))
vi.mock('../pages/console/UsersTab', () => ({ default: () => <h1>People screen</h1> }))
vi.mock('../pages/console/UserHistoryPage', () => ({ default: () => null }))
vi.mock('../pages/console/NotificationsPage', () => ({ default: () => null }))

import { ToastProvider } from '../components/Toaster'
import Console from '../pages/Console'

const mount = () => render(<ToastProvider><Console /></ToastProvider>)
const open = (name) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => { window.sessionStorage.clear(); auth.me = { id: 'u1', email: 'ana@example.com', role: 'admin', status: 'approved' }; auth.isAdmin = true })
afterEach(cleanup)

describe('Console tab on refresh', () => {
  it('opens on Screening the first time', async () => {
    mount()
    expect(await screen.findByText('Screening screen')).toBeTruthy()
  })

  it('stays on the tab that was open when the page is refreshed', async () => {
    mount()
    open(/Lists/)
    expect(await screen.findByText('Lists screen')).toBeTruthy()
    cleanup()                                   // a refresh: everything is mounted again from scratch
    mount()
    expect(await screen.findByText('Lists screen')).toBeTruthy()
    expect(screen.queryByText('Screening screen')).toBeNull()
    expect(screen.getByRole('button', { name: /Lists/ }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps following the person as they move between tabs', async () => {
    mount()
    open(/History/)
    await screen.findByText('History screen')
    open(/Monitoring/)
    await screen.findByText('Monitoring screen')
    cleanup()
    mount()
    expect(await screen.findByText('Monitoring screen')).toBeTruthy()
  })

  it('does not hand one person\'s tab to another, or the People tab to someone who is not an administrator', async () => {
    mount()
    open(/People/)
    await screen.findByText('People screen')
    cleanup()
    auth.me = { id: 'u2', email: 'bob@example.com', role: 'user', status: 'approved' }
    auth.isAdmin = false
    mount()
    expect(await screen.findByText('Screening screen')).toBeTruthy()
    cleanup()
    window.sessionStorage.setItem('console-tab:u2', 'people')   // a stale or tampered value
    mount()
    expect(await screen.findByText('Screening screen')).toBeTruthy()
  })

  it('still works when the browser will not let the page store anything', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    mount()
    open(/Lists/)
    expect(await screen.findByText('Lists screen')).toBeTruthy()
    spy.mockRestore()
  })
})
