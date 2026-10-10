import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../api', () => ({
  reviewApplicant: vi.fn(),
  exportHistory: vi.fn(),
  checkCoverage: vi.fn(),
  listApplicants: vi.fn().mockResolvedValue([
    { id: 7, full_name: 'Reviewed Person', submitted_at: '2026-10-01T00:00:00Z', overall_status: 'MANUAL_REVIEW', review_decision: 'cleared' },
  ]),
  getApplicant: vi.fn(),
}))

import { ToastProvider } from '../components/Toaster'
import ReviewPanel from '../components/ReviewPanel'
import HistoryTab from '../pages/console/HistoryTab'
import { reviewApplicant, exportHistory } from '../api'

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('review decision', () => {
  it('saves the chosen decision with the note and shows it', async () => {
    reviewApplicant.mockResolvedValue({ applicant_id: 7, review_decision: 'confirmed', review_note: 'Same DOB', reviewed_at: '2026-10-02T10:00:00Z' })
    const onChange = vi.fn()
    render(<ToastProvider><ReviewPanel applicantId={7} onChange={onChange} /></ToastProvider>)
    const save = screen.getByRole('button', { name: 'Save decision' })
    expect(save.disabled).toBe(true)                                    // nothing chosen yet
    fireEvent.click(screen.getByRole('button', { name: 'Confirmed match' }))
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Same DOB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save decision' }))
    await waitFor(() => expect(reviewApplicant).toHaveBeenCalledWith(7, 'confirmed', 'Same DOB'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('confirmed'))
    expect(await screen.findByText(/Confirmed match, saved/)).toBeTruthy()
  })

  it('can remove a saved decision', async () => {
    reviewApplicant.mockResolvedValue({ applicant_id: 7, review_decision: null, review_note: null, reviewed_at: null })
    render(<ToastProvider><ReviewPanel applicantId={7} decision="cleared" note="x" reviewedAt="2026-10-01T00:00:00Z" /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove decision' }))
    await waitFor(() => expect(reviewApplicant).toHaveBeenCalledWith(7, null, ''))
    expect(await screen.findByText(/Not reviewed yet/)).toBeTruthy()
  })
})

describe('history list', () => {
  it('shows each row\'s decision and offers a CSV download', async () => {
    exportHistory.mockResolvedValue()
    render(<ToastProvider><HistoryTab /></ToastProvider>)
    expect(await screen.findByText('Decision: Cleared')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Download as CSV' }))
    await waitFor(() => expect(exportHistory).toHaveBeenCalledTimes(1))
  })
})
