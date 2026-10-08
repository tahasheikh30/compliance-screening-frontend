import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react'

vi.mock('../api', () => ({
  listApplicants: vi.fn(),
  getApplicant: vi.fn(),
}))
import { listApplicants } from '../api'
import HistoryTab from '../pages/console/HistoryTab'
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

describe('HistoryTab with the cache', () => {
  it('shows the last answer at once when reopened, then replaces it with the fresh one', async () => {
    listApplicants.mockResolvedValueOnce([row(1, 'Old Name')])
    const first = render(<HistoryTab isAdmin />)
    expect(await screen.findByText('Old Name')).toBeTruthy()
    first.unmount()

    let release
    listApplicants.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    render(<HistoryTab isAdmin />)
    // the request is still pending, yet the table is already there
    expect(screen.getByText('Old Name')).toBeTruthy()
    expect(screen.queryByText('Loading...')).toBeNull()
    await act(async () => { release([row(2, 'New Name')]) })
    expect(await screen.findByText('New Name')).toBeTruthy()
    expect(screen.queryByText('Old Name')).toBeNull()
  })

  it('ignores a slow answer for Everyone\'s when Mine was chosen in the meantime', async () => {
    let releaseAll
    listApplicants.mockImplementation(({ mine }) => (mine
      ? Promise.resolve([row(7, 'Mine Only')])
      : new Promise((resolve) => { releaseAll = resolve })))
    render(<HistoryTab isAdmin />)
    fireEvent.click(screen.getByRole('button', { name: 'Mine' }))
    expect(await screen.findByText('Mine Only')).toBeTruthy()
    await act(async () => { releaseAll([row(8, 'Someone Else')]) })
    expect(screen.queryByText('Someone Else')).toBeNull()
    expect(screen.getByText('Mine Only')).toBeTruthy()
  })

  it('draws a long history a page at a time', async () => {
    listApplicants.mockResolvedValue(Array.from({ length: 130 }, (_, i) => row(i + 1, `Person ${i + 1}`)))
    render(<HistoryTab isAdmin />)
    expect(await screen.findByText('Person 1')).toBeTruthy()
    expect(screen.queryByText('Person 101')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show more \(30 more\)/ }))
    await waitFor(() => expect(screen.getByText('Person 130')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Show more/ })).toBeNull()
  })
})
