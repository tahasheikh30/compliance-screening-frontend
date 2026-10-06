// Build time settings (Vite replaces import.meta.env.VITE_* when the app is built).
//
//   VITE_API_BASE_URL              the backend address (see api.js)
//   VITE_API_KEY                   the app's key: the same value as APP_API_KEY on the backend. It tells the
//                                  backend "this request comes from the app". It is built into the page, so
//                                  anyone who opens the app can read it: it is NOT a secret and opens nothing
//                                  without a signed in person. Never put the backend's secret API_KEY here.
//   VITE_SUPABASE_URL              https://<project>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY  the project's publishable (anon) key. Public by design.
//   VITE_TURNSTILE_SITE_KEY        optional. The Cloudflare Turnstile SITE key (public). Set it when CAPTCHA
//                                  protection is on in Supabase (Authentication, Attack Protection). The secret
//                                  key goes in Supabase only, never here.

export function readConfig(env = import.meta.env) {
  return {
    apiKey: String(env.VITE_API_KEY || '').trim(),
    supabaseUrl: String(env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, ''),
    supabaseKey: String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim(),
    turnstileSiteKey: String(env.VITE_TURNSTILE_SITE_KEY || '').trim(),
  }
}

function jwtRole(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).role
  } catch {
    return null
  }
}

/**
 * Anything wrong with the settings, as sentences an administrator can act on. An empty list means ready.
 * Refuses a SECRET Supabase key outright: anything VITE_ prefixed is shipped to every visitor's browser.
 */
export function configProblems(cfg) {
  const problems = []
  if (!cfg.apiKey) problems.push('VITE_API_KEY is not set. It must be the same value as APP_API_KEY on the backend.')
  if (!cfg.supabaseUrl) {
    problems.push('VITE_SUPABASE_URL is not set (https://<project>.supabase.co).')
  } else if (!/^https:\/\/[^/\s]+$/i.test(cfg.supabaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cfg.supabaseUrl)) {
    problems.push('VITE_SUPABASE_URL must look like https://<project>.supabase.co (no path, no trailing slash).')
  }
  if (!cfg.supabaseKey) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is not set (Supabase dashboard, Project Settings, API Keys).')
  } else if (cfg.supabaseKey.startsWith('sb_secret_') || jwtRole(cfg.supabaseKey) === 'service_role') {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY holds a SECRET key. Remove it from the environment now and rotate it in '
      + 'Supabase: everything starting with VITE_ is delivered to every visitor. Use the publishable (anon) key instead.')
  }
  return problems
}

export const config = readConfig()
