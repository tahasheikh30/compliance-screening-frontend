import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { apiErr, json, makeSupabase, mockApi, sessionFor } from './helpers'

const h = vi.hoisted(() => ({ supabase: null }))
vi.mock('../lib/supabase', () => ({ getSupabase: () => h.supabase }))

let UsersTab
let fetchMock
let users

const USERS = () => ([
  { id: 'self', email: 'boss@example.com', role: 'admin', status: 'approved', created_at: '2026-09-01T10:00:00Z' },
  { id: 'p1', email: 'newbie@example.com', role: 'user', status: 'pending', created_at: '2026-10-02T10:00:00Z' },
  { id: 'u2', email: 'ana@example.com', role: 'user', status: 'approved', created_at: '2026-09-10T10:00:00Z' },
  { id: 'r1', email: 'gone@example.com', role: 'user', status: 'rejected', created_at: '2026-09-12T10:00:00Z' },
])

const posts = () => fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_API_KEY', 'test-app-key')
  h.supabase = makeSupabase({ session: sessionFor('boss@example.com') })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  users = USERS()
  mockApi(fetchMock, {
    'GET /api/admin/users': () => users,
    'POST /api/admin/users/p1/status': (u, init) => {
      const body = JSON.parse(init.body)
      users = users.map((x) => (x.id === 'p1' ? { ...x, status: body.status } : x))
      return users.find((x) => x.id === 'p1')
    },
    'POST /api/admin/users/u2/status': (u, init) => {
      users = users.map((x) => (x.id === 'u2' ? { ...x, status: JSON.parse(init.body).status } : x))
      return users.find((x) => x.id === 'u2')
    },
    'POST /api/admin/users/u2/role': (u, init) => {
      users = users.map((x) => (x.id === 'u2' ? { ...x, role: JSON.parse(init.body).role } : x))
      return users.find((x) => x.id === 'u2')
    },
  })
  UsersTab = (await import('../pages/console/UsersTab.jsx')).default
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('People', () => {
  it('shows who is waiting first and reports the count', async () => {
    const onPendingCount = vi.fn()
    render(<UsersTab selfId="self" onPendingCount={onPendingCount} />)
    expect(await screen.findByText('newbie@example.com')).toBeTruthy()
    expect(screen.queryByText('ana@example.com')).toBeNull()
    expect(screen.getByRole('button', { name: /Waiting \(1\)/ })).toBeTruthy()
    expect(onPendingCount).toHaveBeenCalledWith(1)
  })

  it('approves someone with one click and the list updates', async () => {
    const onPendingCount = vi.fn()
    render(<UsersTab selfId="self" onPendingCount={onPendingCount} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.getByText('Nobody is waiting for approval.')).toBeTruthy())
    expect(posts()).toHaveLength(1)
    expect(JSON.parse(posts()[0][1].body)).toEqual({ status: 'approved' })
    expect(onPendingCount).toHaveBeenLastCalledWith(0)
  })

  it('asks before declining, focuses Cancel, and does nothing if cancelled', async () => {
    render(<UsersTab selfId="self" />)
    await screen.findByText('newbie@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    const row = (await screen.findByText('ana@example.com')).closest('tr')
    fireEvent.click(within(row).getByRole('button', { name: 'Decline' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Decline ana@example.com?')).toBeTruthy()
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(posts()).toHaveLength(0)
  })

  it('declines after confirmation', async () => {
    render(<UsersTab selfId="self" />)
    await screen.findByText('newbie@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    const row = (await screen.findByText('ana@example.com')).closest('tr')
    fireEvent.click(within(row).getByRole('button', { name: 'Decline' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0][0]).toBe('/api/admin/users/u2/status')
    expect(JSON.parse(posts()[0][1].body)).toEqual({ status: 'rejected' })
  })

  it('asks before granting administrator rights', async () => {
    render(<UsersTab selfId="self" />)
    await screen.findByText('newbie@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    const row = (await screen.findByText('ana@example.com')).closest('tr')
    fireEvent.click(within(row).getByRole('button', { name: 'Make administrator' }))
    const dialog = await screen.findByRole('dialog')
    expect(posts()).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make administrator' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(posts()[0][1].body)).toEqual({ role: 'admin' })
  })

  it('offers no way to decline or demote yourself', async () => {
    render(<UsersTab selfId="self" />)
    await screen.findByText('newbie@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    const row = (await screen.findByText('boss@example.com')).closest('tr')
    expect(within(row).getByText('This is you')).toBeTruthy()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('shows the server\'s refusal to remove the last administrator', async () => {
    mockApi(fetchMock, {
      'GET /api/admin/users': () => users,
      'POST /api/admin/users/u2/role': () => apiErr(409, 'LAST_ADMIN', 'That would leave the tool without an administrator.', 'Make someone else an administrator first.'),
    })
    users = users.map((x) => (x.id === 'u2' ? { ...x, role: 'admin' } : x))
    render(<UsersTab selfId="self" />)
    await screen.findByText('newbie@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    const row = (await screen.findByText('ana@example.com')).closest('tr')
    fireEvent.click(within(row).getByRole('button', { name: 'Make a regular user' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove rights' }))
    expect(await screen.findByText('Keep one administrator')).toBeTruthy()
    expect(screen.getByText('Make someone else an administrator first.')).toBeTruthy()
  })

  it('shows why when the list cannot be loaded', async () => {
    mockApi(fetchMock, { 'GET /api/admin/users': () => apiErr(403, 'ADMIN_ONLY', 'Only an administrator can do this.') })
    render(<UsersTab selfId="self" />)
    expect(await screen.findByText('Administrators only')).toBeTruthy()
  })
})
