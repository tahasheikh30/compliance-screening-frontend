// Company and footer settings, in one place.
//
// Build time settings (Vite replaces import.meta.env.VITE_* when the app is built). All optional.
// They are built into the page and visible to every visitor, so they must be public addresses only.
//
//   VITE_COMPANY_URL      the company website. Defaults to https://www.packages.com.pk
//   VITE_PRIVACY_URL      the company's privacy policy page. The "Privacy policy" link only shows when this is set.
//   VITE_TERMS_URL        the terms of use page. The "Terms of use" link only shows when this is set.
//   VITE_CONTACT_EMAIL    the address for the "Contact us" link (opens the person's email app)
//   VITE_CONTACT_URL      a contact page instead of an email address. Used when no email is set.
//   VITE_LINKEDIN_URL     the company LinkedIn page. The icon only shows when this is set.
//
// A link is only shown when it has somewhere real to go. "Contact us" falls back to the company website.

export const COMPANY = 'Packages Group'
export const PRODUCT = 'Case File'
const DEFAULT_COMPANY_URL = 'https://www.packages.com.pk'
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/

/** Only plain https addresses are accepted: nothing like javascript: or data: can reach an href. */
function httpsUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    const u = new URL(text)
    return u.protocol === 'https:' ? u.href : ''
  } catch {
    return ''
  }
}

export function readSite(env = import.meta.env) {
  const companyUrl = httpsUrl(env.VITE_COMPANY_URL) || DEFAULT_COMPANY_URL
  const email = String(env.VITE_CONTACT_EMAIL || '').trim()
  const contactHref = EMAIL_RE.test(email)
    ? `mailto:${email}`
    : httpsUrl(env.VITE_CONTACT_URL) || companyUrl
  return {
    company: COMPANY,
    product: PRODUCT,
    companyUrl,
    privacyUrl: httpsUrl(env.VITE_PRIVACY_URL),
    termsUrl: httpsUrl(env.VITE_TERMS_URL),
    linkedinUrl: httpsUrl(env.VITE_LINKEDIN_URL),
    contactHref,
    contactIsEmail: contactHref.startsWith('mailto:'),
  }
}

export const site = readSite()
