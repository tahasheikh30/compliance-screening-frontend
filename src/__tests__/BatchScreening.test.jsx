import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import ScreeningTab from '../pages/console/ScreeningTab'
import BatchScreening from '../pages/console/BatchScreening'
import { ToastProvider } from '../components/Toaster'

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

  it('shows progress, then labelled simulated results that can be filtered', () => {
    vi.useFakeTimers()
    renderBatch()
    upload(file('applicants.xlsx'))
    fireEvent.click(screen.getByRole('button', { name: 'Run batch screening' }))
    expect(screen.getByRole('progressbar', { name: 'Batch progress' })).toBeTruthy()

    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText('Batch screened')).toBeTruthy()
    expect(screen.getAllByText(/Design preview/).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('row').length).toBe(13)          // header + 12 simulated rows

    fireEvent.click(screen.getByRole('button', { name: /Escalated/ }))
    expect(screen.getAllByRole('row').length).toBe(3)           // header + 2 escalated

    fireEvent.click(screen.getByRole('button', { name: 'Screen another file' }))
    expect(screen.getByText('How batch screening works')).toBeTruthy()
  })

  it('can be cancelled while running', () => {
    vi.useFakeTimers()
    renderBatch()
    upload(file('applicants.xlsx'))
    fireEvent.click(screen.getByRole('button', { name: 'Run batch screening' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText('Batch screened')).toBeNull()
  })
})
