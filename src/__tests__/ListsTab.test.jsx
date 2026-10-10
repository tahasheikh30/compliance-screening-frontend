import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react'

vi.mock('../api', () => ({
  getListsStatus: vi.fn(),
  reloadLists: vi.fn(),
  getNactaStatus: vi.fn(),
  uploadNacta: vi.fn(),
  getPepStatus: vi.fn(),
  uploadPep: vi.fn(),
  deletePepUpload: vi.fn(),
}))
import { getListsStatus, getNactaStatus, reloadLists, getPepStatus, uploadPep, deletePepUpload } from '../api'
import ListsTab from '../pages/console/ListsTab'

afterEach(() => { cleanup(); vi.clearAllMocks() })

const ok = (list, records, extra = {}) => ({ list, records, status: 'OK', published: null, source: null, ...extra })
const status = (over = {}) => ({
  UNSC: { cached: true, age_seconds: 5, records: 100, error: null, lists: [ok('UN Security Council Consolidated List', 100, { source: 'https://un.example/x.xml' })] },
  OFAC: { cached: true, age_seconds: 5, records: 30, error: null, lists: [ok('OFAC SDN List', 20), ok('OFAC Consolidated List', 10)] },
  UKSL: { cached: true, age_seconds: 5, records: 10, error: null, lists: [ok('UK Sanctions List (FCDO)', 10)] },
  FIA_REDBOOK: {
    cached: true, age_seconds: 5, records: 143, error: null,
    lists: [
      ok('FIA Red Book 2025', 143, { source: 'https://www.fia.gov.pk/files/rb.pdf' }),
      { list: 'FIA Red Book Most Wanted Terrorists', records: 0, published: null, source: 'https://www.fia.gov.pk/files/terror.pdf',
        status: 'Downloaded, but no records could be read (the layout is not one the reader understands)', sample: 'S.No Name Head Money\n1 SOMEONE 8,000,000' },
    ],
  },
  NACTA: { cached: true, age_seconds: 5, records: 5294, error: null, lists: [ok('NACTA Proscribed Persons (Fourth Schedule)', 5294)] },
  PEP: { cached: true, age_seconds: 5, records: 900, error: null, lists: [ok('PEP list from Wikidata (national and provincial office holders)', 900)] },
  ...over,
})
const pepStatus = (over = {}) => ({
  wikidata: { loaded: true, records: 900, uploaded_at: '2026-10-08T00:00:00+00:00', age_days: 2 },
  upload: { loaded: false }, wikidata_enabled: true, refresh_days: 7, lookback_years: 5, required: false, ...over,
})
const nacta = (over = {}) => ({ loaded: true, source: 'upload', filename: 'nacta.json', records: 5294, uploaded_at: '2026-10-01T00:00:00+00:00', age_days: 2, max_age_days: 30, stale: false, ...over })

function setup(s = status(), n = nacta(), p = pepStatus()) {
  getListsStatus.mockResolvedValue(s)
  getNactaStatus.mockResolvedValue(n)
  getPepStatus.mockResolvedValue(p)
  return render(<ListsTab />)
}

describe('ListsTab', () => {
  it('shows every list on its own row, including each FIA Red Book', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('FIA Red Book 2025')).toBeTruthy())
    for (const name of ['UN Security Council Consolidated List', 'OFAC SDN List', 'OFAC Consolidated List', 'UK Sanctions List (FCDO)',
      'FIA Red Book 2025', 'FIA Red Book Most Wanted Terrorists', 'NACTA Proscribed Persons (Fourth Schedule)']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    expect(screen.getByText('143')).toBeTruthy()
  })

  it('marks only the Red Book that failed as a problem and says why', async () => {
    setup()
    await waitFor(() => screen.getByText('FIA Red Book Most Wanted Terrorists'))
    const bad = screen.getByText('FIA Red Book Most Wanted Terrorists').closest('tr')
    expect(within(bad).getByText('Problem')).toBeTruthy()
    expect(within(bad).getByText(/Downloaded, but no records could be read/)).toBeTruthy()
    const good = screen.getByText('FIA Red Book 2025').closest('tr')
    expect(within(good).getByText('Ready')).toBeTruthy()
    expect(within(good).queryByText(/no records could be read/)).toBeNull()
  })

  it('offers the text read from an unreadable PDF so its layout can be diagnosed', async () => {
    setup()
    await waitFor(() => screen.getByText('Show the text read from this PDF'))
    const bad = screen.getByText('FIA Red Book Most Wanted Terrorists').closest('tr')
    expect(bad.querySelector('pre').textContent).toContain('S.No Name Head Money')
    expect(within(bad).getByRole('button', { name: 'Copy text' })).toBeTruthy()
    // rows that read fine have no sample
    expect(screen.getByText('FIA Red Book 2025').closest('tr').querySelector('pre')).toBeNull()
  })

  it('links to the source file only when it is an http(s) address', async () => {
    const s = status()
    s.UKSL.lists[0].source = 'javascript:alert(1)'
    setup(s)
    await waitFor(() => screen.getByText('UK Sanctions List (FCDO)'))
    expect(screen.getByText('UK Sanctions List (FCDO)').closest('tr').querySelector('a')).toBeNull()
    expect(screen.getByText('FIA Red Book 2025').closest('tr').querySelector('a').getAttribute('href')).toBe('https://www.fia.gov.pk/files/rb.pdf')
  })

  it('shows a source that has not been loaded yet, and one that failed with its reason', async () => {
    setup(status({
      UKSL: { cached: false, age_seconds: null, records: 0, error: null, lists: [] },
      UNSC: { cached: false, age_seconds: null, records: 0, error: 'The list could not be downloaded or read (ConnectionError: timed out).',
        lists: [{ list: 'UNSC', records: 0, status: 'The list could not be downloaded or read (ConnectionError: timed out).', source: null }] },
    }))
    await waitFor(() => screen.getByText('UK Sanctions List (FCDO)'))
    const uk = screen.getByText('UK Sanctions List (FCDO)').closest('tr')
    expect(within(uk).getByText('Not loaded yet')).toBeTruthy()
    const un = screen.getByText('UN Security Council Consolidated List').closest('tr')   // named properly, not "UNSC"
    expect(within(un).getByText('Problem')).toBeTruthy()
    expect(within(un).getByText(/ConnectionError: timed out/)).toBeTruthy()
  })

  it('shows the fallback note when the live NACTA download failed', async () => {
    const s = status()
    s.NACTA.lists[0].note = 'The live download from NACTA failed (timed out). Using the last good copy, 2 days old.'
    setup(s, nacta({ source: 'url', url: 'https://nfs.example.pk/export.json', live_copy: true }))
    await waitFor(() => screen.getByText(/Using the last good copy, 2 days old/))
    expect(screen.getByText(/Downloaded automatically from/)).toBeTruthy()
  })

  it('summarises a reload by naming the lists that have a problem', async () => {
    setup()
    reloadLists.mockResolvedValue({ UNSC: { records: 100 }, FIA_REDBOOK: { records: 143 } })
    await waitFor(() => screen.getByText('FIA Red Book 2025'))
    fireEvent.click(screen.getByRole('button', { name: 'Reload all lists now' }))
    await waitFor(() => screen.getByRole('status'))
    const msg = screen.getAllByRole('status').map((e) => e.textContent).join(' ')
    expect(msg).toMatch(/1 list has a problem: FIA Red Book Most Wanted Terrorists/)
  })

  it('says every list loaded when nothing has a problem', async () => {
    const s = status()
    s.FIA_REDBOOK.lists[1] = ok('FIA Red Book Most Wanted Terrorists', 1331)
    setup(s)
    reloadLists.mockResolvedValue({})
    await waitFor(() => screen.getByText('FIA Red Book 2025'))
    fireEvent.click(screen.getByRole('button', { name: 'Reload all lists now' }))
    await waitFor(() => expect(screen.getAllByRole('status').map((e) => e.textContent).join(' ')).toMatch(/Every list loaded/))
  })

  it('lists the PEP source and explains that a PEP is not a sanctions hit', async () => {
    setup()
    await waitFor(() => expect(screen.getByText('PEP list from Wikidata (national and provincial office holders)')).toBeTruthy())
    expect(await screen.findByText(/not a\s+sanctions hit/)).toBeTruthy()
    expect(await screen.findByText(/Wikidata copy: 900 people/)).toBeTruthy()
  })

  it('uploads an administrator PEP list and reports national and provincial counts', async () => {
    uploadPep.mockResolvedValue({ records: 4, national: 1, provincial: 3, rows_skipped: 0, warnings: ['No usable CNIC numbers were found, so matching will rely on names alone.'] })
    setup()
    const input = await screen.findByLabelText(/Your own PEP list/)
    const file = new File(['Name,Position\nX,Senator'], 'pep.csv', { type: 'text/csv' })
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload PEP list' }))
    await waitFor(() => expect(uploadPep).toHaveBeenCalledWith(file))
    expect(await screen.findByText(/1 national, 3 provincial/)).toBeTruthy()
    expect(screen.getByText(/No usable CNIC numbers/)).toBeTruthy()
  })

  it('lets an administrator remove their own list, and warns when no PEP data is loaded at all', async () => {
    deletePepUpload.mockResolvedValue(pepStatus())
    setup(status(), nacta(), pepStatus({ upload: { loaded: true, filename: 'pep.csv', records: 4, uploaded_at: '2026-10-09T00:00:00+00:00', age_days: 1 } }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove my list' }))
    await waitFor(() => expect(deletePepUpload).toHaveBeenCalled())
    cleanup()
    setup(status(), nacta(), pepStatus({ wikidata: { loaded: false }, required: true }))
    expect(await screen.findByText(/No PEP data is loaded/)).toBeTruthy()
    expect(screen.getByText(/manual review until some is loaded/)).toBeTruthy()
  })
})
