import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../auth/AuthContext', () => ({
  MIN_PASSWORD_LENGTH: 12,
  useAuth: () => ({ me: { id: 'u1', email: 'ana@example.com', role: 'user', status: 'approved' }, isAdmin: false, changePassword: vi.fn() }),
}))
vi.mock('../api', () => ({
  clearMyHistory: vi.fn(),
  listUserApplicants: vi.fn().mockResolvedValue([]),
  listApplicants: vi.fn().mockResolvedValue([]),
  getApplicant: vi.fn(),
}))

import { ToastProvider } from '../components/Toaster'
import AccountPage from '../pages/console/AccountPage'
import UserHistoryPage from '../pages/console/UserHistoryPage'
import { clearMyHistory } from '../api'

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('clear search history (Account)', () => {
  it('asks to confirm, then clears and says what was kept', async () => {
    clearMyHistory.mockResolvedValue({ deleted: 3, kept_monitored: 1 })
    render(<ToastProvider><AccountPage /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear search history' }))
    expect(clearMyHistory).not.toHaveBeenCalled()                       // nothing is deleted by the first click
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await waitFor(() => expect(clearMyHistory).toHaveBeenCalledTimes(1))
    const note = await screen.findByText(/3 screenings deleted/)
    expect(note.textContent).toContain('1 under continuous monitoring was kept')
  })

  it('can be cancelled without deleting anything', () => {
    render(<ToastProvider><AccountPage /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear search history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(clearMyHistory).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Clear search history' })).toBeTruthy()
  })

  it('shows the error when it fails and deletes nothing it was not told to', async () => {
    clearMyHistory.mockRejectedValue(new Error('boom'))
    render(<ToastProvider><AccountPage /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear search history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await waitFor(() => expect(clearMyHistory).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})

describe('person history page layout', () => {
  it('puts Back to People above the card, not inside it', async () => {
    const { container } = render(<UserHistoryPage user={{ id: 'u2', email: 'bilal@example.com' }} onBack={() => {}} />)
    const back = screen.getByRole('button', { name: 'Back to People' })
    expect(back.closest('.sheet')).toBeNull()                           // not in the card
    const card = container.querySelector('.sheet')
    expect(back.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()   // before the card
    await screen.findByText('bilal@example.com has not screened anyone yet.')
  })
})
