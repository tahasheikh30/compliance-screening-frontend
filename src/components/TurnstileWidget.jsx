import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise = null

/** Load Cloudflare's script once for the whole page. Resolves window.turnstile. */
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const tag = document.createElement('script')
      tag.src = SCRIPT_SRC
      tag.async = true
      tag.defer = true
      tag.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not start')))
      tag.onerror = () => {
        scriptPromise = null          // allow another try
        tag.remove()
        reject(new Error('Turnstile could not be loaded'))
      }
      document.head.appendChild(tag)
    })
  }
  return scriptPromise
}

/**
 * Cloudflare Turnstile check, the human check Supabase Auth asks for when CAPTCHA protection is on.
 *
 *   siteKey   the widget's PUBLIC site key (VITE_TURNSTILE_SITE_KEY). The secret key lives in Supabase only.
 *   onToken   called with the token when the check passes, and with null when it expires or fails.
 *
 * A token works once. Call ref.current.reset() after every sign in or sign up attempt to get a fresh one.
 */
const TurnstileWidget = forwardRef(function TurnstileWidget({ siteKey, onToken }, ref) {
  const box = useRef(null)
  const widgetId = useRef(null)
  const onTokenRef = useRef(onToken)
  const [problem, setProblem] = useState(null)
  onTokenRef.current = onToken

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current?.(null)
      if (widgetId.current != null && window.turnstile) window.turnstile.reset(widgetId.current)
    },
  }), [])

  useEffect(() => {
    let cancelled = false
    loadTurnstile().then((turnstile) => {
      if (cancelled || !box.current) return
      widgetId.current = turnstile.render(box.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token) => { setProblem(null); onTokenRef.current?.(token) },
        'expired-callback': () => onTokenRef.current?.(null),
        'timeout-callback': () => onTokenRef.current?.(null),
        'error-callback': () => {
          onTokenRef.current?.(null)
          setProblem('The security check failed to run. Reload the page and try again.')
        },
      })
    }).catch(() => {
      if (!cancelled) setProblem('The security check could not be loaded. Check your connection and reload the page.')
    })
    return () => {
      cancelled = true
      if (widgetId.current != null && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [siteKey])

  return (
    <div className="captcha-line">
      <div ref={box} />
      {problem && <p className="field-hint" role="alert">{problem}</p>}
    </div>
  )
})

export default TurnstileWidget
