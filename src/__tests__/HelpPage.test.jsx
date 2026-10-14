import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react'
import HelpPage from '../pages/console/HelpPage'
import { SECTIONS, TAB_GUIDE } from '../pages/console/helpContent'

afterEach(cleanup)

describe('HelpPage', () => {
  it('lists every section in the contents and shows the manual', () => {
    render(<HelpPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'User manual' })).toBeTruthy()
    const toc = screen.getByRole('navigation', { name: 'Manual contents' })
    const visible = SECTIONS.filter((s) => !s.admin)
    expect(within(toc).getAllByRole('button')).toHaveLength(visible.length)
    for (const s of visible) expect(screen.getByRole('heading', { level: 2, name: s.title })).toBeTruthy()
  })

  it('hides administrator sections and tools from regular users, and shows them to administrators', () => {
    render(<HelpPage />)
    expect(screen.queryByRole('heading', { level: 2, name: /^People/ })).toBeNull()
    expect(screen.queryByText(/Reload all lists now/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Open People/ })).toBeNull()
    cleanup()
    render(<HelpPage isAdmin />)
    expect(screen.getByRole('heading', { level: 2, name: /^People/ })).toBeTruthy()
    expect(screen.getByText(/Reload all lists now/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open People/ })).toBeTruthy()
  })

  it('the tab buttons open the tab', () => {
    const onOpen = vi.fn()
    render(<HelpPage onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: /Open Monitoring/ }))
    expect(onOpen).toHaveBeenCalledWith('monitoring')
    expect(TAB_GUIDE.length).toBeGreaterThan(3)
  })

  it('search narrows the manual, says how many matched, and can be cleared', () => {
    render(<HelpPage />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the manual' }), { target: { value: 'evidence pdf' } })
    expect(screen.getByRole('status').textContent).toMatch(/topics? match/)
    expect(screen.queryByRole('heading', { level: 2, name: 'Signing in and your account' })).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Reading a result' })).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the manual' }), { target: { value: 'zzzzqq' } })
    expect(screen.getByText('No topic matches.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Reading a result' })).toBeTruthy()
  })

  it('does not search administrator text for regular users', () => {
    render(<HelpPage />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the manual' }), { target: { value: 'reload all lists' } })
    expect(screen.queryByRole('heading', { level: 2, name: 'Watch lists' })).toBeNull()
  })

  it('a contents button scrolls to its section', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(<HelpPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Glossary' }))
    expect(scroll).toHaveBeenCalled()
    expect(document.activeElement.textContent).toMatch(/Glossary/)
  })

  it('renders bold marks as emphasis and never as raw stars', () => {
    render(<HelpPage />)
    expect(document.body.textContent).not.toMatch(/\*\*/)
    expect(document.querySelectorAll('.help-section strong').length).toBeGreaterThan(20)
  })

  it('uses no dashes as punctuation in the manual text', () => {
    const text = JSON.stringify(SECTIONS)
    expect(text).not.toMatch(/[–—]/)
  })
})
