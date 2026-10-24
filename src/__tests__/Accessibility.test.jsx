import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, waitFor } from '@testing-library/react'
import axe from 'axe-core'

vi.mock('../auth/AuthContext', () => ({
  MIN_PASSWORD_LENGTH: 12,
  useAuth: () => ({ me: { id: 'u1', email: 'ana@example.com', role: 'admin', status: 'approved' }, isAdmin: true, changePassword: vi.fn(), leaveWithNotice: vi.fn() }),
}))
vi.mock('../api', async () => ({ ...(await import('./aiMocks')).aiApi,
  screenApplicant: vi.fn(), clearMyHistory: vi.fn(), exportHistory: vi.fn(), reviewApplicant: vi.fn(),
  listApplicants: vi.fn().mockResolvedValue([{ id: 1, full_name: 'Some Person', submitted_at: '2026-10-01T00:00:00Z', overall_status: 'AUTO_CLEAR' }]),
  getApplicant: vi.fn(),
  getMonitoringStatus: vi.fn().mockResolvedValue({ enabled: true, interval_seconds: 86400, monitored_applicants: 1, open_alerts: 0, sources: [] }),
  listAlerts: vi.fn().mockResolvedValue([]), decideAlert: vi.fn(), setMonitoring: vi.fn(),
  listMonitoredPeople: vi.fn().mockResolvedValue([{ applicant_id: 4, full_name: 'Hamza Example', father_name: 'Bilal Example', dob: '1990-05-01', monitored_since: '2026-10-01T08:00:00Z', last_monitored_at: null, open_alerts: 1 }]),
  getListsStatus: vi.fn().mockResolvedValue({ UNSC: { available: true, records: 10, lists: [{ list: 'UN', records: 10, status: 'OK' }] } }),
  getNactaStatus: vi.fn().mockResolvedValue({ loaded: false }), getPepStatus: vi.fn().mockResolvedValue({ loaded: false }),
  reloadLists: vi.fn(), uploadNacta: vi.fn(), uploadPep: vi.fn(), deletePepUpload: vi.fn(), refreshPep: vi.fn(), checkCoverage: vi.fn(),
  listUsers: vi.fn().mockResolvedValue([{ id: 'u2', email: 'bob@example.com', role: 'user', status: 'pending', created_at: '2026-09-10T10:00:00Z' }]),
  deleteUser: vi.fn(), setUserRole: vi.fn(), setUserStatus: vi.fn(),
  cancelBatch: vi.fn(), downloadBatchEvidence: vi.fn(), downloadBatchResults: vi.fn(), getBatch: vi.fn(), startBatch: vi.fn(),
  listUserApplicants: vi.fn().mockResolvedValue([]),
}))

import { ToastProvider } from '../components/Toaster'
import ScreeningTab from '../pages/console/ScreeningTab'
import HistoryTab from '../pages/console/HistoryTab'
import MonitoringTab from '../pages/console/MonitoringTab'
import ListsTab from '../pages/console/ListsTab'
import UsersTab from '../pages/console/UsersTab'
import AccountSection from '../components/settings/AccountSection'
import HelpPage from '../pages/console/HelpPage'

afterEach(cleanup)

// jsdom has no layout, so colour contrast and visibility checks cannot run here; the structural rules do
// (names on controls, labels on fields, roles, duplicate ids, landmarks inside the page).
async function violations(container) {
  const out = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })
  return out.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')})`)
}

const screens = [
  ['Screening', () => <ScreeningTab />, /Screen an applicant/i],
  ['History', () => <HistoryTab />, /Some Person/],
  ['Monitoring', () => <MonitoringTab />, /monitor/i],
  ['Lists', () => <ListsTab isAdmin />, /Watch lists/],
  ['People', () => <UsersTab selfId="u1" onPendingCount={() => {}} onOpenHistory={() => {}} />, /bob@example.com/],
  ['Account', () => <AccountSection />, /Change password/],
  ['Help (administrator)', () => <HelpPage isAdmin onOpen={() => {}} />, /User manual/],
  ['Help (user)', () => <HelpPage onOpen={() => {}} />, /User manual/],
]

describe('accessibility (structural rules)', () => {
  for (const [name, view, ready] of screens) {
    it(`${name} has no violations`, async () => {
      const { container } = render(<ToastProvider>{view()}</ToastProvider>)
      await waitFor(() => expect(screen.getAllByText(ready).length).toBeGreaterThan(0))
      expect(await violations(container)).toEqual([])
    })
  }
})
