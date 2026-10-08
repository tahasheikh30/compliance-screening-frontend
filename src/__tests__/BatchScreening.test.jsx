import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react'
import ScreeningTab from '../pages/console/ScreeningTab'
import BatchScreening from '../pages/console/BatchScreening'
import { ToastProvider } from '../components/Toaster'
import { ApiError } from '../lib/apiError'
import { forget, remember } from '../lib/readCache'

const api = vi.hoisted(() => ({
  startBatch: vi.fn(), getBatch: vi.fn(), cancelBatch: vi.fn(), getApplicant: vi.fn(),
  downloadBatchResults: vi.fn(), downloadBatchEvidence: vi.fn(), setMonitoring: vi.fn(),
}))
vi.mock('../api', async (importOriginal) => ({ ...(await importOriginal()), ...api }))

beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()); forget() })
afterEach(() => { cleanup(); vi.useRealTimers() })

const file = (name, size = 2048) => new File([new Uint8Array(size)], name)
const upload = (f) => fireEvent.change(document.getElementById('batch-file'), { target: { files: [f] } })
const renderBatch = () => render(<ToastProvider><BatchScreening /></ToastProvider>)

describe('individual and batch switch', () => {
  it('starts on individual and switches with a click and the arrow keys', () => {
    render(<ToastProvider><ScreeningTab /></ToastProvider>)
    const individual = screen.getByRole('tab', { name: /Individual/ })
    const batch = screen.getByRole('tab', { name: /Batch/ })
    expect(individual.getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('Screen a file of applicants')).toBeNull()

    fireEvent.click(batch)
    expect(batch.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Screen a file of applicants')).toBeTruthy()

    fireEvent.keyDown(batch, { key: 'ArrowLeft' })
    expect(individual.getAttribute('aria-selected')).toBe('true')
  })

  it('keeps what was typed on the individual form while batch is showing', () => {
    render(<ToastProvider><ScreeningTab /></ToastProvider>)
    fireEvent.change(document.getElementById('full-name-input'), { target: { value: 'Ayesha Khan' } })
    fireEvent.click(screen.getByRole('tab', { name: /Batch/ }))
    fireEvent.click(screen.getByRole('tab', { name: /Individual/ }))
    expect(document.getElementById('full-name-input').value).toBe('Ayesha Khan')
  })
})

describe('batch upload', () => {
  it('cannot run until a file is chosen', () => {
    renderBatch()
    expect(screen.getByRole('button', { name: 'Run batch screening' }).disabled).toBe(true)
  })

  it('accepts Excel and Word files and shows the file', () => {
    renderBatch()
    upload(file('applicants.xlsx'))
    expect(screen.getByText('applicants.xlsx')).toBeTruthy()
    expect(screen.getByText(/Excel file/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run batch screening' }).disabled).toBe(false)
    cleanup()
    renderBatch()
    upload(file('applicants.docx'))
    expect(screen.getByText(/Word file/)).toBeTruthy()
  })

  it('refuses other types, empty files, oversized files and several files', () => {
    renderBatch()
    upload(file('notes.pdf'))
    expect(screen.getByText('That file type is not supported.')).toBeTruthy()
    upload(file('empty.xlsx', 0))
    expect(screen.getByText('That file is empty.')).toBeTruthy()
    upload(file('huge.xlsx', 10 * 1024 * 1024 + 1))
    expect(screen.getByText('That file is too large.')).toBeTruthy()
    fireEvent.change(document.getElementById('batch-file'), { target: { files: [file('a.xlsx'), file('b.xlsx')] } })
    expect(screen.getByText('Upload one file at a time.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run batch screening' }).disabled).toBe(true)
  })
})

const row = (n, over = {}) => ({
  row: n, full_name: `Person ${n}`, state: 'screened', error: null, applicant_id: 100 + n, overall_status: 'AUTO_CLEAR',
  sanctions: 0, news: 0, case_ref: `CS-20261008-0010${n}`, dob: null, nationality: null, ...over,
})
const unscreened = (n, over = {}) => row(n, { state: 'invalid', applicant_id: null, overall_status: null, sanctions: null, news: null, case_ref: null, ...over })
const finishedBatch = (over = {}) => ({
  id: 7, filename: 'applicants.xlsx', status: 'done', total: 4, done: 4, threshold: 85, monitor: false,
  created_at: '2026-10-08T09:00:00+00:00', finished_at: '2026-10-08T09:01:00+00:00',
  counts: { screened: 3, invalid: 1, failed: 0, pending: 0, ESCALATE_TO_COMPLIANCE: 1, MANUAL_REVIEW: 0, AUTO_CLEAR: 2 },
  rows: [
    row(2, { overall_status: 'ESCALATE_TO_COMPLIANCE', sanctions: 2, news: 1 }), row(3),
    unscreened(4, { full_name: '', error: 'Full name is missing.' }), row(5),
  ],
  ...over,
})
const running = (done, total = 4) => finishedBatch({ status: 'running', done, finished_at: null, rows: [], counts: {} })

const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const run = async () => { fireEvent.click(screen.getByRole('button', { name: 'Run batch screening' })); await flush() }

describe('a real batch', () => {
  it('sends the file with the threshold and the monitoring choice, and shows progress while it runs', async () => {
    vi.useFakeTimers()
    api.startBatch.mockResolvedValue(running(0))
    api.getBatch.mockResolvedValue(running(2))
    renderBatch()
    const f = file('applicants.xlsx')
    upload(f)
    fireEvent.click(document.getElementById('batch-monitor'))
    fireEvent.change(document.getElementById('batch-threshold'), { target: { value: '90' } })
    await run()
    expect(api.startBatch).toHaveBeenCalledWith(f, { threshold: 90, monitor: true })
    expect(screen.getByRole('progressbar', { name: 'Batch progress' })).toBeTruthy()
    await flush(1600)
    expect(api.getBatch).toHaveBeenCalledWith(7)
    expect(screen.getByRole('progressbar', { name: 'Batch progress' }).getAttribute('aria-valuenow')).toBe('50')
  })

  it('shows the results once the server says it is done, with rows that were not screened kept visible', async () => {
    vi.useFakeTimers()
    api.startBatch.mockResolvedValue(running(0))
    api.getBatch.mockResolvedValueOnce(running(2)).mockResolvedValue(finishedBatch())
    renderBatch()
    upload(file('applicants.xlsx'))
    await run()
    await flush(1600)
    await flush(1600)
    expect(screen.getByRole('heading', { name: 'Batch screened' })).toBeTruthy()
    expect(screen.getAllByRole('row').length).toBe(5)           // header + 4 rows of the file
    expect(screen.queryByText(/Design preview/)).toBeNull()
    const bad = screen.getByText('Full name is missing.').closest('tr')
    expect(within(bad).getByText('Not screened')).toBeTruthy()
    expect(within(bad).queryByRole('button', { name: 'View case' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'View case' }).length).toBe(3)
    expect(screen.getByText(/1 row was not screened/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Escalated/ })).toBeTruthy()
  })

  it('filters by outcome, including the rows that were not screened', async () => {
    vi.useFakeTimers()
    api.startBatch.mockResolvedValue(finishedBatch())
    renderBatch()
    upload(file('applicants.xlsx'))
    await run()
    fireEvent.click(screen.getByRole('button', { name: /Escalated/ }))
    expect(screen.getAllByRole('row').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /Not screened/ }))
    expect(screen.getAllByRole('row').length).toBe(2)
    expect(screen.getByText('Full name is missing.')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter by outcome' })).getByRole('button', { name: /Clear/ }))
    expect(screen.getAllByRole('row').length).toBe(3)
  })

  it('a cancelled batch lists the rows it did not reach as not screened, never as clear', async () => {
    vi.useFakeTimers()
    api.startBatch.mockResolvedValue(finishedBatch({
      status: 'cancelled', done: 2, total: 3,
      counts: { screened: 1, invalid: 0, failed: 0, pending: 2, ESCALATE_TO_COMPLIANCE: 0, MANUAL_REVIEW: 0, AUTO_CLEAR: 1 },
      rows: [row(2), unscreened(3, { state: 'pending', error: null }), unscreened(4, { state: 'pending', error: null })],
    }))
    renderBatch()
    upload(file('applicants.xlsx'))
    await run()
    expect(screen.getByRole('heading', { name: 'Batch cancelled' })).toBeTruthy()
    expect(screen.getAllByText('Not reached before the batch stopped.').length).toBe(2)
    expect(screen.getAllByText('Not screened').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/cancelled\. Rows not reached/)).toBeTruthy()
  })

  it('Cancel asks the server to stop and says so while the row in progress finishes', async () => {
    vi.useFakeTimers()
    api.startBatch.mockResolvedValue(running(1))
    api.getBatch.mockResolvedValue(running(1))
    api.cancelBatch.mockResolvedValue(running(1))
    renderBatch()
    upload(file('applicants.xlsx'))
    await run()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await flush()
    expect(api.cancelBatch).toHaveBeenCalledWith(7)
    expect(screen.getByText(/Stopping after the row in progress/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stopping...' }).disabled).toBe(true)
  })

  it('shows why a file was refused and lets the person try again', async () => {
    vi.useFakeTimers()
    api.startBatch.mockRejectedValue(new ApiError({ status: 422, code: 'BATCH_NO_NAME_COLUMN', message: 'The file has no Full name column.', hint: 'Put the column names in the first row.' }))
    renderBatch()
    upload(file('applicants.xlsx'))
    await run()
    expect(screen.getByText('The file has no Full name column.')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Run batch screening' }).disabled).toBe(false)
  })

  it('keeps going when a progress check fails, and shows the problem', async () => {
    vi.useFakeTimers()
    api.startBatch.mockResolvedValue(running(0))
    api.getBatch
      .mockRejectedValueOnce(new ApiError({ code: 'NETWORK_ERROR', message: 'Cannot reach the backend.' }))
      .mockResolvedValue(finishedBatch())
    renderBatch()
    upload(file('applicants.xlsx'))
    await run()
    await flush(1600)
    expect(screen.getByText('Cannot reach the backend.')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Batch progress' })).toBeTruthy()
    await flush(5000)
    expect(screen.getByRole('heading', { name: 'Batch screened' })).toBeTruthy()
  })

  it('stops asking when the page is left, and picks the batch up again on return', async () => {
    vi.useFakeTimers()
    api.startBatch.mockResolvedValue(running(0))
    api.getBatch.mockResolvedValue(running(1))
    const first = renderBatch()
    upload(file('applicants.xlsx'))
    await run()
    first.unmount()
    api.getBatch.mockClear()
    await flush(5000)
    expect(api.getBatch).not.toHaveBeenCalled()

    api.getBatch.mockResolvedValue(finishedBatch())
    renderBatch()
    await flush()
    expect(api.getBatch).toHaveBeenCalledWith(7)
    expect(screen.getByRole('heading', { name: 'Batch screened' })).toBeTruthy()
  })

  it('does not remember anything about a batch beyond its id, and forgets even that on a new file', async () => {
    api.startBatch.mockResolvedValue(finishedBatch())
    renderBatch()
    upload(file('applicants.xlsx'))
    fireEvent.click(screen.getByRole('button', { name: 'Run batch screening' }))
    await act(async () => {})
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/Person|applicants/)
    expect(JSON.stringify({ ...sessionStorage })).not.toMatch(/Person|applicants/)
    fireEvent.click(screen.getByRole('button', { name: 'Screen another file' }))
    expect(screen.getByText('How batch screening works')).toBeTruthy()
    cleanup()
    renderBatch()
    await act(async () => {})
    expect(api.getBatch).not.toHaveBeenCalled()
  })

  it('opens a row as a full case, and returns to the same results', async () => {
    api.startBatch.mockResolvedValue(finishedBatch())
    api.getApplicant.mockResolvedValue({
      applicant_id: 102, full_name: 'Person 2', overall_status: 'ESCALATE_TO_COMPLIANCE', case_ref: 'CS-20261008-00102',
      threshold: 85, monitored: false, results: [],
    })
    renderBatch()
    upload(file('applicants.xlsx'))
    fireEvent.click(screen.getByRole('button', { name: 'Run batch screening' }))
    await act(async () => {})
    fireEvent.click(screen.getAllByRole('button', { name: 'View case' })[0])
    await act(async () => {})
    expect(api.getApplicant).toHaveBeenCalledWith(102)
    expect(screen.getByRole('button', { name: 'Back to the batch results' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Batch screened', hidden: true }).closest('[hidden]')).toBeTruthy()     // results wait behind the case
    fireEvent.click(screen.getByRole('button', { name: 'Back to the batch results' }))
    expect(screen.getByRole('heading', { name: 'Batch screened' }).closest('[hidden]')).toBeNull()
    expect(screen.getAllByRole('row').length).toBe(5)
  })

  it('downloads the results, and only offers evidence when something was found', async () => {
    api.startBatch.mockResolvedValue(finishedBatch())
    api.downloadBatchResults.mockResolvedValue()
    renderBatch()
    upload(file('applicants.xlsx'))
    fireEvent.click(screen.getByRole('button', { name: 'Run batch screening' }))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Download results (.xlsx)' }))
    await act(async () => {})
    expect(api.downloadBatchResults).toHaveBeenCalledWith(7)
    expect(screen.getByRole('button', { name: 'Evidence (.zip)' }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Evidence (.zip)' }))
    await act(async () => {})
    expect(api.downloadBatchEvidence).toHaveBeenCalledWith(7)
  })

  it('has no evidence button to press when every row was clear', async () => {
    api.startBatch.mockResolvedValue(finishedBatch({
      counts: { screened: 2, invalid: 0, failed: 0, pending: 0, ESCALATE_TO_COMPLIANCE: 0, MANUAL_REVIEW: 0, AUTO_CLEAR: 2 },
      rows: [row(2), row(3)], total: 2, done: 2,
    }))
    renderBatch()
    upload(file('applicants.xlsx'))
    fireEvent.click(screen.getByRole('button', { name: 'Run batch screening' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Evidence (.zip)' }).disabled).toBe(true)
  })
})
