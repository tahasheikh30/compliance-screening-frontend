# Case File: Applicant Screening Frontend

Vite + React console for screening an applicant against the UN, OFAC, UK,
FIA Red Book and NACTA watch lists plus an open news search, reading the
findings, and downloading the evidence PDF. It talks to the screening backend
(`compliance-screening-backend`).

## What it does

**Screening.** Enter a full name (required), plus an optional date of birth,
nationality, CNIC, father's or husband's name and match threshold (50 to 100,
default 85). A CNIC is checked for 13 digits when you leave the field. The FIA
Red Book and NACTA publish CNICs, so a CNIC that equals a listed one is
reported as a match whatever the name looks like, and is called out above the
sources. A matching father's name is shown as supporting evidence. The result is a
stamped verdict (Escalate, Review or Clear), the number of watch-list
matches and news leads, a next step, and one card per source. Each match
shows its score, reference, programme, listed date of birth (flagged when
the birth year matches), nationality, aliases and the source's remarks.
News leads link out to the article. The evidence PDF downloads from the
verdict.

A source that could not be downloaded or read is shown as **Not screened**
and makes the verdict at best Review. It is never shown as clear. A source
made of several lists (the FIA publishes more than one Red Book) shows each
list with its record count, and is marked **Incomplete** if one could not be
read, or if the NACTA copy is out of date.

**History.** Every past screening, searchable by name and filterable by
outcome. Opening one shows the same full report and evidence download.

**Lists.** Every list on its own row (the FIA Red Books and the two OFAC lists
are shown one by one), with whether it could be read, its record count and how
old it is. A list that failed is highlighted with the reason and a link to its
source file, and a PDF that downloaded but gave no people offers the text that
was read from it, so an unsupported layout can be diagnosed from the screen.
There is also a button to reload everything now. Normally unnecessary: the
backend downloads the lists live and reuses them for a while.

The same page loads the **NACTA Proscribed Persons** list. NACTA's portal has no
download address (it is a Blazor Server app), so the list is a file: click JSON
on the portal and upload it here. The backend repo's `scripts/fetch_nacta.py`
does the same with a browser on a schedule, so nobody has to. The page shows which file is loaded and how old it
is, warns when a file looks like a partial export, and the screening reports
NACTA as incomplete once the copy is older than the backend's limit (30 days
by default).

A screening takes 20 to 40 seconds when the lists are not already loaded,
because the backend downloads them live. The loading panel says what is
being checked and how long it has been running. It does not show a progress
bar, because the backend does not report progress.

## Access control

The app shows an access-key gate on load. Enter the same value as the
backend's `API_KEY`. Unlocking does three checks in order: it wakes the
backend if Render has put it to sleep (the gate says so and waits, up to about
a minute), confirms the backend can reach its Supabase database, then confirms
the backend accepts the key (`GET /api/me`). Only then is the key stored (in
`sessionStorage`, so it clears when the tab closes) and sent as `X-API-Key` on
every request, including evidence downloads and the NACTA upload. There is no
separate frontend secret, and the key is never built into the bundle.

**Backend setting required.** The backend now has Supabase sign in, and by
default it accepts `API_KEY` only for the scheduled NACTA upload. For this
console to work with the key, set this on the backend (Render) and redeploy:

```
ALLOW_API_KEY_FULL_ACCESS=true
```

With it on, everyone who has the key shares one identity: the key gives full
admin access, screenings are not attributed to a person, History shows every
screening, and the rate limits (10 screenings a minute) are shared. If the
setting is off, the gate says exactly this instead of a generic error.

**Connection behaviour.**
- `VITE_API_BASE_URL` may be given as a bare host, with `https://` or with a
  trailing slash. `/api` is added if missing.
- Reads are retried up to three times on temporary trouble (server asleep, a
  502/503/504, a dropped connection), honouring the server's `Retry-After`.
- A screening is never retried. The server is woken first, and if a screening
  times out the error says it may still have finished and to check History.
- Every request carries an `X-Request-ID`, shown as the Reference on errors, so
  a timed out request can still be found in the server log.
- If the backend refuses the key later (rotated, or key access switched off),
  the app returns to the gate and says why.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit and component tests (vitest)
npm run build
```

In dev, Vite's proxy (see `vite.config.js`) forwards `/api` to a backend on
`localhost:8000`. Start the backend with
`API_KEY=dev ALLOW_API_KEY_FULL_ACCESS=true DATABASE_URL=... SUPABASE_URL=... uvicorn app.main:app`
and enter `dev` at the gate.

## Deploying to Vercel

1. Push this folder as its own repo and import it into Vercel (it
   auto-detects Vite).
2. Set this environment variable (see `.env.example`):

   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com/api
   ```

   Without it the app calls `/api` on Vercel's own domain, which does not
   exist. The key is not an environment variable: people type it at the gate. The dev proxy only works locally.
3. Deploy (`npm run build`, output `dist/`).

The backend's `ALLOWED_ORIGINS` must include the Vercel URL, or the browser
blocks the requests with a CORS error. `vercel.json` rewrites all paths to
`/index.html`, which stops a hard reload of a shared URL returning a 404.

## Design

The case-file idea is kept, with different materials: a slate desk, white
bond-paper sheets with a manila spine and tab, and rubber-stamp verdicts.
Headings use a Charter/Palatino serif stack, the interface uses the system
sans, and references, scores and dates use tabular monospace.

Two moments are animated, both only in response to an action and both
switched off under `prefers-reduced-motion` (checked in a browser with
reduced motion requested): the magnifying glass while a screening runs, and
the stamp landing when a result arrives.

## Compliance and accessibility checklist

This is an internal, authenticated tool for a compliance analyst, not a
consumer website. Items below say what was checked and what was not.

**Checked:**
- **Colour contrast.** Every text and background pairing in `index.css` was
  computed against WCAG AA (4.5:1 for normal text). Status colours have
  separate `-dark` variants for the dark desk, because the paper variants
  fail on dark backgrounds.
- **Keyboard.** The whole flow works without a mouse: Enter submits the form,
  the threshold slider responds to arrow keys, history rows open with Enter,
  and focus moves to the verdict heading when a result appears. Visible
  `:focus-visible` outlines on every interactive element.
- **Dialog.** The data notice is a native `<dialog>` opened with
  `showModal()`: the browser traps focus and handles Escape, and it opens
  at the top with focus on its heading. Clicking outside closes it.
- **Third-party requests.** None from the browser. Fonts are system fonts, and
  a browser-level check of every request during a full session found none to
  any host other than the app itself. Note that the **backend** sends the
  applicant's name to Google News for the adverse media check. The data
  notice says so.
- **Links.** News links open only if they are `http` or `https`, with
  `rel="noopener noreferrer"`. Anything else is shown as plain text.
- **Only collect necessary data.** The form collects a name (required), and
  an optional date of birth, nationality, CNIC and father's or husband's
  name. Each is used: date of birth and nationality, and a father's name, are
  shown next to matches as supporting evidence and never remove one, and a CNIC
  that equals a listed CNIC is reported as a match. They are all optional.
  The CNIC is a national identity number, so treat the stored screening
  history and evidence PDFs accordingly.
- **Consent.** A notice sits beside the form, and a fuller data handling
  notice is one click away. This is internal-facing language, not lawyered
  policy text. Have compliance or legal review it.
- **Narrow screens.** Checked at 390px wide: layout stacks and nothing
  scrolls sideways.
- **Footer.** Identifies this as an internal IGI General Takaful tool.

**Not done:** a screen reader pass, and testing in browsers other than
Chromium. Both are worth doing before relying on this with real applicants.

**Not applicable:** alt text (no images), refund policy and T&Cs (no
payments), reviews, image copyright, and cookie consent (no cookies; the
access key is in `sessionStorage`).

None of this replaces a legal or compliance review before this is used with
real applicant data. It is a technical pass, not a sign-off.
