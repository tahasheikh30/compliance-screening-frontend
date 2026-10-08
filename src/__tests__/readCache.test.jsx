import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react'

vi.mock('../api', () => ({
  listApplicants: vi.fn(),
  listUserApplicants: vi.fn(),
  getApplicant: vi.fn(),
  setMonitoring: vi.fn(),
}))
import { listApplicants, listUserApplicants } from '../api'
import HistoryTab from '../pages/console/HistoryTab'
import UserHistoryPage from '../pages/console/UserHistoryPage'
import { peek, remember, forget } from '../lib/readCache'

const row = (id, name, overall_status = 'AUTO_CLEAR') => ({ id, full_name: name, overall_status, submitted_at: '2026-10-01T10:00:00+00:00', screened_by: 'ana@example.com' })

beforeEach(() => forget())
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('readCache', () => {
  it('remembers a value, forgets by prefix, and forgets everything with no prefix', () => {
    remember('history:all', [1])
    remember('history:mine', [2])
    remember('lists:status', { a: 1 })
    expect(peek('history:all')).toEqual([1])
    forget('history:')
    expect(peek('history:all')).toBeNull()
    expect(peek('history:mine')).toBeNull()
    expect(peek('lists:status')).toEqual({ a: 1 })
    forget()
    expect(peek('lists:status')).toBeNull()
  })
})

describe('HistoryTab', () => {
  it('shows only the signed in person\'s own screenings: no Mine / Everyone switch, no screener column', async () => {
    listApplicants.mockResolvedValue([row(1, 'Own Screening')])
    render(<HistoryTab />)
    expect(await screen.findByText('Own Screening')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mine' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Everyone' })).toBeNull()
    expect(screen.queryByText(/Screened by/)).toBeNull()
    expect(listApplicants).toHaveBeenCalledTimes(1)
  })

  it('shows the last answer at once when reopened, then replaces it with the fresh one', async () => {
    listApplicants.mockResolvedValueOnce([row(1, 'Old Name')])
    const first = render(<HistoryTab />)
    expect(await screen.findByText('Old Name')).toBeTruthy()
    first.unmount()

    let release
    listApplicants.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    render(<HistoryTab />)
    expect(screen.getByText('Old Name')).toBeTruthy()          // the request is pending, yet the table is there
    expect(screen.queryByText('Loading...')).toBeNull()
    await act(async () => { release([row(2, 'New Name')]) })
    expect(await screen.findByText('New Name')).toBeTruthy()
    expect(screen.queryByText('Old Name')).toBeNull()
  })

  it('draws a long history a page at a time', async () => {
    listApplicants.mockResolvedValue(Array.from({ length: 130 }, (_, i) => row(i + 1, `Person ${i + 1}`)))
    render(<HistoryTab />)
    expect(await screen.findByText('Person 1')).toBeTruthy()
    expect(screen.queryByText('Person 101')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show more \(30 more\)/ }))
    await waitFor(() => expect(screen.getByText('Person 130')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull()
  })
})

describe('a person\'s history (People tab)', () => {
  const user = { id: 'u-ana', email: 'ana@example.com' }

  it('loads that person\'s screenings, offers no monitoring switch, and goes back', async () => {
    listUserApplicants.mockResolvedValue([row(5, 'Screened By Ana')])
    const onBack = vi.fn()
    render(<UserHistoryPage user={user} onBack={onBack} />)
    expect(await screen.findByText('Screened By Ana')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Screenings by ana@example.com' })).toBeTruthy()
    expect(listUserApplicants).toHaveBeenCalledWith('u-ana')
    expect(listApplicants).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to People' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('ignores a slow answer for one person when another was opened meanwhile', async () => {
    let releaseAna
    listUserApplicants.mockImplementation((id) => (id === 'u-ana'
      ? new Promise((resolve) => { releaseAna = resolve })
      : Promise.resolve([row(9, 'Screened By Bilal')])))
    const view = render(<UserHistoryPage user={user} onBack={() => {}} />)
    view.rerender(<UserHistoryPage user={{ id: 'u-bilal', email: 'bilal@example.com' }} onBack={() => {}} />)
    expect(await screen.findByText('Screened By Bilal')).toBeTruthy()
    await act(async () => { releaseAna([row(8, 'Screened By Ana')]) })
    expect(screen.queryByText('Screened By Ana')).toBeNull()
    expect(screen.getByText('Screened By Bilal')).toBeTruthy()
  })

  it('shows an empty message for someone who has screened nobody', async () => {
    listUserApplicants.mockResolvedValue([])
    render(<UserHistoryPage user={user} onBack={() => {}} />)
    expect(await screen.findByText('ana@example.com has not screened anyone yet.')).toBeTruthy()
  })
})
