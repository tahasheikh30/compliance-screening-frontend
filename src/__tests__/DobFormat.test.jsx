import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ me: { id: 'u1', email: 'ana@example.com', role: 'user', status: 'approved' }, isAdmin: false }),
}))
vi.mock('../api', async () => ({ ...(await import('./aiMocks')).aiApi,
  screenApplicant: vi.fn(), getPreferences: vi.fn(), savePreferences: vi.fn(),
  startBatch: vi.fn(), getBatch: vi.fn(), cancelBatch: vi.fn(), downloadBatchEvidence: vi.fn(), downloadBatchResults: vi.fn(),
}))

import { ToastProvider } from '../components/Toaster'
import ScreeningTab from '../pages/console/ScreeningTab'
import { maskDob, parseDob, dobProblem } from '../lib/dob'
import { screenApplicant } from '../api'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const TODAY = new Date('2026-10-14T12:00:00Z')

describe('dob helpers', () => {
  it('puts the slashes in as digits are typed', () => {
    expect(maskDob('2')).toBe('2')
    expect(maskDob('251')).toBe('25/1')
    expect(maskDob('25121')).toBe('25/12/1')
    expect(maskDob('25121990')).toBe('25/12/1990')
    expect(maskDob('251219901234')).toBe('25/12/1990')
    expect(maskDob('abc')).toBe('')
  })
  it('pads a date typed or pasted with separators', () => {
    expect(maskDob('1/5/1990')).toBe('01/05/1990')
    expect(maskDob('1-5-1990')).toBe('01/05/1990')
    expect(maskDob('1/')).toBe('01/')
    expect(maskDob('01/05/')).toBe('01/05/')
  })
  it('turns dd/mm/yyyy into the yyyy-mm-dd the server takes', () => {
    expect(parseDob('25/12/1990', TODAY)).toBe('1990-12-25')
    expect(parseDob('04/03/1975', TODAY)).toBe('1975-03-04')      // 4 March, not 3 April
  })
  it('refuses dates that do not exist, are in the future, or are too old', () => {
    expect(parseDob('31/02/1990', TODAY)).toBeNull()
    expect(parseDob('29/02/2023', TODAY)).toBeNull()
    expect(parseDob('15/10/2026', TODAY)).toBeNull()
    expect(parseDob('14/10/2026', TODAY)).toBe('2026-10-14')
    expect(parseDob('01/01/1899', TODAY)).toBeNull()
    expect(parseDob('1/1/1990', TODAY)).toBeNull()
  })
  it('explains what is wrong', () => {
    expect(dobProblem('', TODAY)).toBeNull()
    expect(dobProblem('25/12/1990', TODAY)).toBeNull()
    expect(dobProblem('25/12', TODAY)).toMatch(/dd\/mm\/yyyy/)
    expect(dobProblem('31/02/1990', TODAY)).toMatch(/does not exist/)
    expect(dobProblem('15/10/2026', TODAY)).toMatch(/future/)
    expect(dobProblem('01/01/1850', TODAY)).toMatch(/before 1900/)
  })
})

describe('date of birth in the screening form', () => {
  const mount = () => render(<ToastProvider><ScreeningTab /></ToastProvider>)
  const type = (value) => fireEvent.change(document.getElementById('dob-input'), { target: { value } })

  it('is written dd/mm/yyyy and sent to the server as yyyy-mm-dd', async () => {
    screenApplicant.mockResolvedValue({ id: 1, full_name: 'Some Person', overall_status: 'AUTO_CLEAR', results: [], monitored: false })
    mount()
    const input = document.getElementById('dob-input')
    expect(input.getAttribute('placeholder')).toBe('dd/mm/yyyy')
    fireEvent.change(document.getElementById('full-name-input'), { target: { value: 'Some Person' } })
    type('25121990')
    expect(input.value).toBe('25/12/1990')
    fireEvent.click(screen.getByRole('button', { name: 'Run screening' }))
    await waitFor(() => expect(screenApplicant).toHaveBeenCalled())
    expect(screenApplicant.mock.calls[0][0].dob).toBe('1990-12-25')
  })

  it('does not run with a date that is not real, and says why', () => {
    mount()
    fireEvent.change(document.getElementById('full-name-input'), { target: { value: 'Some Person' } })
    type('31/02/1990')
    expect(screen.getByText('That date does not exist.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run screening' }).disabled).toBe(true)
    expect(screenApplicant).not.toHaveBeenCalled()
  })

  it('can be left empty', async () => {
    screenApplicant.mockResolvedValue({ id: 1, full_name: 'Some Person', overall_status: 'AUTO_CLEAR', results: [], monitored: false })
    mount()
    fireEvent.change(document.getElementById('full-name-input'), { target: { value: 'Some Person' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run screening' }))
    await waitFor(() => expect(screenApplicant).toHaveBeenCalled())
    expect(screenApplicant.mock.calls[0][0].dob).toBe('')
  })
})
