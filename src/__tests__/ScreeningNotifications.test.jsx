import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ me: { id: 'u1', email: 'ana@example.com', role: 'user', status: 'approved' }, isAdmin: false }),
}))
vi.mock('../api', async () => ({ ...(await import('./aiMocks')).aiApi,
  screenApplicant: vi.fn(), getPreferences: vi.fn(), savePreferences: vi.fn(),
  startBatch: vi.fn(), getBatch: vi.fn(), cancelBatch: vi.fn(), downloadBatchEvidence: vi.fn(), downloadBatchResults: vi.fn(),
}))

import { ToastProvider } from '../components/Toaster'
import { PreferencesProvider, withDefaults } from '../lib/preferences'
import ScreeningTab from '../pages/console/ScreeningTab'
import { screenApplicant, getPreferences } from '../api'

const server = (over) => ({ preferences: withDefaults(over), switchable_sources: [] })
const result = { id: 1, full_name: 'Some Person', overall_status: 'AUTO_CLEAR', results: [], monitored: false }

async function runScreening(prefs, outcome = result) {
  getPreferences.mockResolvedValue(server(prefs))
  screenApplicant.mockResolvedValue(outcome)
  render(<ToastProvider><PreferencesProvider><ScreeningTab /></PreferencesProvider></ToastProvider>)
  await waitFor(() => expect(getPreferences).toHaveBeenCalled())
  fireEvent.change(document.getElementById('full-name-input'), { target: { value: 'Some Person' } })
  fireEvent.click(screen.getByRole('button', { name: 'Run screening' }))
  await waitFor(() => expect(screenApplicant).toHaveBeenCalled())
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup(); localStorage.clear() })

describe('screening notifications', () => {
  it('shows the "Screening complete" pop-up by default', async () => {
    await runScreening({})
    await waitFor(() => expect(document.querySelector('.toaster')?.textContent).toContain('Screening complete'))
  })

  it('does not show it once "Screenings and batches" is switched off in Settings', async () => {
    await runScreening({ notifications: { categories: { screening: false } } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run screening' })).toBeTruthy())   // the run has finished
    await new Promise((r) => setTimeout(r, 100))
    expect(document.querySelector('.toaster')).toBeNull()
  })

  it('also hides a possible-match result (shown red) when the switch is off, since the result is on screen', async () => {
    await runScreening({ notifications: { categories: { screening: false } } }, { ...result, overall_status: 'ESCALATE_TO_COMPLIANCE' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run screening' })).toBeTruthy())
    await new Promise((r) => setTimeout(r, 100))
    expect(document.querySelector('.toaster')).toBeNull()
  })

  it('still shows a possible-match result while the switch is on', async () => {
    await runScreening({}, { ...result, overall_status: 'ESCALATE_TO_COMPLIANCE' })
    await waitFor(() => expect(document.querySelector('.toaster')?.textContent).toContain('Screening complete'))
  })

  it('still shows a screening that failed, switch off or not', async () => {
    getPreferences.mockResolvedValue(server({ notifications: { categories: { screening: false } } }))
    screenApplicant.mockRejectedValue(new Error('The server did not answer.'))
    render(<ToastProvider><PreferencesProvider><ScreeningTab /></PreferencesProvider></ToastProvider>)
    await waitFor(() => expect(getPreferences).toHaveBeenCalled())
    fireEvent.change(document.getElementById('full-name-input'), { target: { value: 'Some Person' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run screening' }))
    await waitFor(() => expect(document.querySelector('.toaster')?.textContent).toContain('Screening did not finish'))
  })
})
