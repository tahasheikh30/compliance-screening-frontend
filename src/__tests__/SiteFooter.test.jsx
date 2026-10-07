import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import SiteFooter from '../components/SiteFooter'
import { readSite } from '../lib/site'

afterEach(() => cleanup())

describe('footer settings', () => {
  it('defaults to the Packages Group website and shows only links that have a destination', () => {
    const s = readSite({})
    expect(s.company).toBe('Packages Group')
    expect(s.companyUrl).toBe('https://www.packages.com.pk')
    expect(s.privacyUrl).toBe('')
    expect(s.termsUrl).toBe('')
    expect(s.linkedinUrl).toBe('')
    expect(s.contactHref).toBe('https://www.packages.com.pk')       // falls back to the company site
    expect(s.contactIsEmail).toBe(false)
  })

  it('uses an email address for contact when one is given, and a contact page otherwise', () => {
    expect(readSite({ VITE_CONTACT_EMAIL: 'help@example.com' }).contactHref).toBe('mailto:help@example.com')
    expect(readSite({ VITE_CONTACT_EMAIL: 'help@example.com' }).contactIsEmail).toBe(true)
    expect(readSite({ VITE_CONTACT_URL: 'https://example.com/contact' }).contactHref).toBe('https://example.com/contact')
  })

  it('refuses anything that is not a plain https address', () => {
    const s = readSite({
      VITE_PRIVACY_URL: 'javascript:alert(1)',
      VITE_TERMS_URL: 'http://example.com/terms',
      VITE_COMPANY_URL: 'data:text/html,hi',
      VITE_CONTACT_EMAIL: 'not an email',
    })
    expect(s.privacyUrl).toBe('')
    expect(s.termsUrl).toBe('')
    expect(s.companyUrl).toBe('https://www.packages.com.pk')
    expect(s.contactHref).toBe('https://www.packages.com.pk')
  })
})

describe('SiteFooter', () => {
  it('shows Packages Group branding and no longer says internal tool or IGI Holdings', () => {
    render(<SiteFooter />)
    expect(screen.getAllByText(/Packages Group/).length).toBeGreaterThan(0)
    expect(screen.getByText(`\u00A9 ${new Date().getFullYear()} Packages Group. All rights reserved.`)).toBeTruthy()
    expect(screen.queryByText(/Internal tool/i)).toBeNull()
    expect(screen.queryByText(/IGI Holdings/i)).toBeNull()
  })

  it('has company, legal and support links, with outbound links opened safely', () => {
    render(<SiteFooter />)
    for (const name of ['Company', 'Legal', 'Support']) expect(screen.getByRole('heading', { name })).toBeTruthy()
    const about = screen.getByRole('link', { name: /About Packages Group/ })
    expect(about.getAttribute('href')).toBe('https://www.packages.com.pk')
    expect(about.getAttribute('target')).toBe('_blank')
    expect(about.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByRole('link', { name: /Contact us/ })).toBeTruthy()
    // no privacy or terms link without an address to send people to
    expect(screen.queryByRole('link', { name: /Privacy policy/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Terms of use/ })).toBeNull()
  })

  it('opens the data handling notice from the footer', async () => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', '') }   // jsdom has none
    render(<SiteFooter />)
    fireEvent.click(screen.getByRole('button', { name: 'Data handling notice' }))
    expect(await screen.findByRole('heading', { name: 'Data handling notice', hidden: true })).toBeTruthy()
  })
})
