import { createClient } from '@supabase/supabase-js'
import { config } from './config'

let client = null

/**
 * The one Supabase client. It handles sign in, keeps the session (in this browser's localStorage, under
 * one key) and refreshes the access token before it expires. PKCE is the current standard flow for browser
 * apps: the email confirmation link carries a one time code, not a token.
 */
export function getSupabase() {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'screening-auth',
      },
    })
  }
  return client
}
