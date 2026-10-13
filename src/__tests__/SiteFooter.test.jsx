import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import SiteFooter from '../components/SiteFooter'
import { readSite } from '../lib/site'

afterEach(() => cleanup())

describe('footer settings', () => {
  it('defaults to the real Packages Group pages', () => {
    const s = readSite({})
    expect(s.company).toBe('Packages Group')
    expect(s.companyUrl).toBe('https://www.packages.com.pk')
    expect(s.contactUrl).toBe('https://www.packages.com.pk/contact-us/')
    expect(s.careersUrl).toBe('https://www.packages.com.pk/careers/')
    expect(s.privacyUrl).toBe('')   // empty: the app's own /privacy page is used
    expect(s.termsUrl).toBe('')
    expect(s.social.map((x) => x.key)).toEqual(['linkedin', 'facebook', 'instagram', 'x'])
  })

  it('lets contact and careers addresses be overridden with https addresses', () => {
    const s = readSite({ VITE_CONTACT_URL: 'https://example.com/contact', VITE_CAREERS_URL: 'https://example.com/jobs' })
    expect(s.contactUrl).toBe('https://example.com/contact')
    expect(s.careersUrl).toBe('https://example.com/jobs')
  })

  it('refuses anything that is not a plain https address', () => {
    const s = readSite({
      VITE_PRIVACY_URL: 'javascript:alert(1)',
      VITE_TERMS_URL: 'http://example.com/terms',
      VITE_COMPANY_URL: 'data:text/html,hi',
      VITE_CONTACT_URL: 'javascript:alert(1)',
      VITE_LINKEDIN_URL: 'http://example.com/li',
    })
    expect(s.privacyUrl).toBe('')
    expect(s.termsUrl).toBe('')
    expect(s.companyUrl).toBe('https://www.packages.com.pk')
    expect(s.contactUrl).toBe('https://www.packages.com.pk/contact-us/')
    expect(s.social.find((x) => x.key === 'linkedin').href).toBe('https://www.linkedin.com/company/packages-group/')
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

  it('has company, explore, legal and support columns', () => {
    render(<SiteFooter />)
    for (const name of ['Company', 'Explore', 'Legal', 'Support']) expect(screen.getByRole('heading', { name })).toBeTruthy()
    const about = screen.getByRole('link', { name: /About Packages Group/ })
    expect(about.getAttribute('href')).toBe('https://www.packages.com.pk')
    expect(about.getAttribute('target')).toBe('_blank')
    expect(about.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('sends Contact us and Careers to the Packages Group website', () => {
    render(<SiteFooter />)
    const contact = screen.getByRole('link', { name: /Contact us/ })
    expect(contact.getAttribute('href')).toBe('https://www.packages.com.pk/contact-us/')
    expect(contact.getAttribute('target')).toBe('_blank')
    const careers = screen.getByRole('link', { name: /Careers/ })
    expect(careers.getAttribute('href')).toBe('https://www.packages.com.pk/careers/')
    expect(careers.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('links to the privacy, terms, cookie and accessibility pages, in a new tab so no work is lost', () => {
    render(<SiteFooter />)
    const expected = { 'Privacy policy': '/privacy', 'Terms of use': '/terms', 'Cookie notice': '/cookies', Accessibility: '/accessibility' }
    for (const [name, href] of Object.entries(expected)) {
      const link = screen.getByRole('link', { name: new RegExp(name) })
      expect(link.getAttribute('href')).toBe(href)
      expect(link.getAttribute('target')).toBe('_blank')
    }
  })

  it('navigates in place from the legal pages themselves', () => {
    render(<SiteFooter inPlace />)
    expect(screen.getByRole('link', { name: /Privacy policy/ }).getAttribute('target')).toBeNull()
  })

  it('has social links and a logo that loads from the site root on every page', () => {
    render(<SiteFooter />)
    expect(screen.getByRole('link', { name: /Packages Group on LinkedIn/ }).getAttribute('href')).toBe('https://www.linkedin.com/company/packages-group/')
    expect(screen.getByRole('link', { name: /Packages Group on Facebook/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Packages Group on Instagram/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Packages Group on X/ })).toBeTruthy()
    expect(screen.getByAltText('Packages Group').getAttribute('src')).toBe('/packages_logo_footer.webp')
  })

  it('opens the data handling notice from the footer', async () => {
    HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', '') }   // jsdom has none
    render(<SiteFooter />)
    fireEvent.click(screen.getByRole('button', { name: 'Data handling notice' }))
    expect(await screen.findByRole('heading', { name: 'Data handling notice', hidden: true })).toBeTruthy()
  })
})
