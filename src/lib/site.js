// Company and footer settings, in one place.
//
// The footer links to the real Packages Group website by default. Build time settings (Vite replaces
// import.meta.env.VITE_* when the app is built) are optional overrides. They are built into the page and
// visible to every visitor, so they must be public https addresses only.
//
//   VITE_COMPANY_URL    the company website. Defaults to https://www.packages.com.pk
//   VITE_CONTACT_URL    the "Contact us" page. Defaults to <company site>/contact-us/
//   VITE_CAREERS_URL    the "Careers" page. Defaults to <company site>/careers/
//   VITE_PRIVACY_URL    send "Privacy policy" to an outside page instead of this app's own /privacy page
//   VITE_TERMS_URL      send "Terms of use" to an outside page instead of this app's own /terms page
//   VITE_LINKEDIN_URL / VITE_FACEBOOK_URL / VITE_INSTAGRAM_URL / VITE_X_URL   the social icons

export const COMPANY = 'Packages Group'
export const PRODUCT = 'Sentinel'
const DEFAULT_COMPANY_URL = 'https://www.packages.com.pk'

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
  const onSite = (path) => new URL(path, companyUrl).href
  return {
    company: COMPANY,
    product: PRODUCT,
    companyUrl,
    // pages on the Packages Group website
    contactUrl: httpsUrl(env.VITE_CONTACT_URL) || onSite('/contact-us/'),
    careersUrl: httpsUrl(env.VITE_CAREERS_URL) || onSite('/careers/'),
    storyUrl: onSite('/our-story/'),
    groupCompaniesUrl: onSite('/#packages-groups'),
    sustainabilityUrl: onSite('/sustainability/'),
    policiesUrl: onSite('/policies/'),
    investorsUrl: onSite('/investor-relations/'),
    newsUrl: onSite('/news-updates/'),
    // empty means "use this app's own page"
    privacyUrl: httpsUrl(env.VITE_PRIVACY_URL),
    termsUrl: httpsUrl(env.VITE_TERMS_URL),
    address: 'Shahrah-e-Roomi, P.O. Amer Sidhu, Lahore 54760, Pakistan',
    phone: '+92-42-35811541',
    social: [
      { key: 'linkedin', label: 'LinkedIn', href: httpsUrl(env.VITE_LINKEDIN_URL) || 'https://www.linkedin.com/company/packages-group/' },
      { key: 'facebook', label: 'Facebook', href: httpsUrl(env.VITE_FACEBOOK_URL) || 'https://www.facebook.com/PackagesGroup/' },
      { key: 'instagram', label: 'Instagram', href: httpsUrl(env.VITE_INSTAGRAM_URL) || 'https://www.instagram.com/packagesgroup' },
      { key: 'x', label: 'X', href: httpsUrl(env.VITE_X_URL) || 'https://twitter.com/PackagesGroup' },
    ],
  }
}

export const site = readSite()
