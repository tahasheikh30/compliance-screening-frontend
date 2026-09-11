# Account Screening — Frontend

Vite + React console for submitting applicants and viewing screening
results, with downloadable evidence PDFs for any hit.

## Access control

The app shows an access-key gate on load. Enter the same value as the
backend's `API_KEY` — it's verified against the backend before being stored
(in `sessionStorage`, so it clears when the tab closes) and sent as
`X-API-Key` on every request, including evidence downloads. There's no
separate frontend secret; the backend is what actually enforces this.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173 — in dev, Vite's proxy (see `vite.config.js`)
forwards `/api` calls to a backend running on `localhost:8000`.

## Deploying to Vercel

1. Push this folder as its own repo, import it into Vercel (it auto-detects
   Vite).
2. In the Vercel project's Environment Variables, set:

   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com/api
   ```

   (See `.env.example`.) Without this, the app will try to call `/api` on
   Vercel's own domain, which doesn't exist — the proxy in `vite.config.js`
   only works for local dev.

3. Deploy. Build command and output directory are auto-detected
   (`npm run build`, `dist/`).

Make sure the backend's `ALLOWED_ORIGINS` env var (on Render) includes this
Vercel URL, or the browser will block the requests with a CORS error.

## 404 on page reload

`vercel.json` rewrites all paths to `/index.html`, which is what fixes the
404-on-reload issue for single-page apps on Vercel — without it, a hard
reload (or someone opening a bookmarked/shared URL directly) hits Vercel's
static file server looking for a matching file, finds none, and 404s. This
app currently only has one route, so the practical impact today is small,
but it's the standard fix and future-proofs against adding routes later.

## Compliance & accessibility checklist

This is an internal, authenticated B2B tool (a compliance analyst screening
account applicants) — not a consumer-facing website. A lot of standard
website-launch checklist items genuinely don't apply here; this section
says explicitly what was checked and why each item does or doesn't apply,
rather than silently skipping any of them.

**Applies, and fixed:**
- **Colour contrast** — every text/background pairing in `index.css` was
  checked against WCAG AA (4.5:1 normal text, 3:1 large text/UI) with an
  actual contrast calculation, not eyeballed. This caught three real
  failures: placeholder text (2.36:1), the muted disclaimer text (3.35:1),
  and the amber "REVIEW" stamp on the light background (3.47:1) — all
  fixed. It also caught a subtler bug: the same status colors were being
  reused for the sidebar's dark background where they measured as low as
  2.01:1 — that needed separate `-dark` color variants, not just a fix in
  one place.
- **Fix accessibility** — visible `:focus-visible` outlines on every
  interactive element (previously relying on browser defaults, which are
  easy to lose against a custom dark background), `role="alert"` +
  `aria-live="polite"` on error messages so screen readers announce them
  without requiring focus to move, `aria-live="polite"` on the results
  section, explicit `id`/`htmlFor` label associations, `aria-modal` +
  `aria-labelledby` + Escape-to-close on the data notice dialog.
- **Check 3rd-party embeds / check tracking** — the app previously loaded
  fonts from Google Fonts, which sends every visitor's IP address to
  Google on page load. Removed entirely; fonts are now system fonts
  (`Georgia`/`ui-monospace`/system sans stack) styled to match the
  original look. The app now makes zero third-party network requests.
- **Form consent** — a notice sits directly above the form stating what's
  collected and why, plus a fuller "data handling notice" modal (data
  collected, purpose, the assumption that applicant consent already exists
  from your standard account-opening process, and a note on Pakistan's
  current legal landscape — Personal Data Protection Bill still in draft,
  PECA 2016 and SBP/SECP regulations currently applicable). This is
  internal-facing language, not lawyered public policy text — have
  compliance/legal review it before treating it as your actual policy.
- **Only collect necessary data** — audited: the form collects exactly
  three fields (name required, CNIC and father's/husband's name optional,
  both solely to reduce false-positive matches). Nothing else is asked
  for. Stated explicitly in the consent notice.
- **Keyboard-friendly forms** — all inputs are native `<input>` elements
  inside a `<form>` (Enter submits, native Tab order), verified end-to-end
  with a keyboard-only pass through the whole flow including the modal.
- **Clear button labels** — reviewed: "Run screening", "Unlock", "Download
  proof (PDF)" are unambiguous; added `aria-label` on the evidence download
  button since its visible text doesn't say *which* result it's for.
- **Add real business details** — added a footer identifying this as an
  internal IGI General Takaful tool. Left the actual contact line as a
  placeholder (`[Add internal compliance contact here]`) rather than
  inventing one — fill that in with a real internal contact.
- **Check local laws** — noted in the data handling notice (see above).
  I'm not a lawyer and this isn't legal advice — confirm specifics with
  your compliance/legal team.
- **Remove unsupported claims** — audited all UI copy; the existing
  language was already appropriately hedged ("automated fuzzy-name
  matching only," "no adverse action without a compliance officer
  confirming identity"). No overclaiming found, no changes needed.

**Checked and confirmed not applicable** (this is an internal KYC tool, not
a consumer website):
- **Alt text on images** — there are no `<img>` elements anywhere in this
  app (the design is CSS-only). Nothing to add alt text to. If a logo
  image is added later, give it real alt text then.
- **Refund policy / T&Cs page** — no payments, no consumer transactions.
- **Remove fake reviews** — no reviews feature exists.
- **Check copyright on images** — no images used.
- **Cookies policy / cookie consent** — the app sets no cookies. The
  access key lives in `sessionStorage`, which isn't cookie-based and isn't
  subject to cookie-consent rules the same way; it also isn't tracking —
  it's the user's own session convenience, cleared when the tab closes.

Nothing here should be read as a substitute for an actual legal/compliance
review before this goes live with real applicant data — it's a good-faith
technical pass, not a sign-off.

