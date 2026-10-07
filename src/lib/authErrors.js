import { ApiError } from './apiError'

/**
 * Turn what Supabase Auth returns into a plain sentence. Raw messages are never shown: some name the
 * mechanism, and "wrong password" must not say whether the address exists.
 */
export function friendlyAuthError(error) {
  const code = error?.code || ''
  const status = error?.status
  const text = String(error?.message || '').toLowerCase()
  const fail = (message, hint) => new ApiError({ code: 'SIGN_IN_FAILED', message, hint })

  if (code === 'captcha_failed' || text.includes('captcha')) {
    return fail('The security check was not accepted.', 'Wait for the check to finish and try again. If it keeps failing, reload the page.')
  }
  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return fail('That email or password is not correct.', 'Check both and try again.')
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return fail('Your email address is not confirmed yet.', 'Open the confirmation link we emailed you, then sign in.')
  }
  if (status === 429 || code.includes('rate_limit') || text.includes('rate limit') || text.includes('too many')) {
    return fail('Too many attempts for now.', 'Wait a few minutes and try again.')
  }
  if (code === 'same_password' || text.includes('different from the old password')) {
    return fail('The new password must be different from your current one.', null)
  }
  if (code === 'reauthentication_needed' || text.includes('reauthentication')) {
    return fail('Please sign in again before changing your password.', 'Sign out, sign in again, then try once more.')
  }
  if (code === 'weak_password' || text.includes('password should') || text.includes('weak password')) {
    return fail('That password is not strong enough.', 'Use at least 12 characters, and avoid common words or passwords you use elsewhere.')
  }
  if (code === 'signup_disabled' || text.includes('signups not allowed')) {
    return fail('New accounts cannot be requested right now.', 'Ask an administrator to open sign ups.')
  }
  if (!status || text.includes('failed to fetch') || text.includes('network') || error?.name === 'AuthRetryableFetchError') {
    return fail('Could not reach the sign in service.', 'Check your connection and try again.')
  }
  return fail('Could not complete that. Please try again.', null)
}
