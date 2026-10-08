# Sentinel by Packages: Applicant Screening Frontend

Vite + React console for screening an applicant against the UN, OFAC, UK,
FIA Red Book and NACTA watch lists plus an open news search, reading the
findings, and downloading the evidence PDF. It talks to the screening backend
(`compliance-screening-backend`).

## What it does

**Screening.** Enter a full name (required), plus an optional date of birth,
nationality, CNIC, father's or husband's name, province and match threshold
(50 to 100, default 85). A CNIC is checked for 13 digits when you leave the field. The FIA
Red Book and NACTA publish CNICs, so a CNIC that equals a listed one is
reported as a match whatever the name looks like, and is called out above the
sources. A matching father's name or province is shown as supporting evidence. The result is a
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

**History.** Your own past screenings, searchable by name and filterable by
outcome. Opening one shows the same full report and evidence download, and a
switch to start or stop continuous monitoring of that person. An administrator
sees only their own screenings here too.

**Monitoring.** Tick "Keep monitoring this person" when screening, or start it
from an opened case. A monitored person is screened again whenever a sanctions
list changes. A new potential match raises a notification in the app and appears
on this tab, where you confirm it or dismiss it with a note. Only the person who
ran the screening sees its alerts, an administrator included. News is not part
of monitoring.

**People (administrators).** Select a person to open their screening history on
its own page, read only, with a back button.

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

People sign in with their own account (email and password, through Supabase Auth). Nobody types a key.

**Two credentials travel with every request**, and the backend requires both:

| Header | What it says | Where it comes from |
|---|---|---|
| `X-API-Key` | which app is calling | `VITE_API_KEY`, the same value as `APP_API_KEY` on the backend |
| `Authorization: Bearer ...` | who is using it | the person's Supabase session, refreshed automatically |

The app key is built into the page, so anyone who opens the app can read it. It is an app identifier, not
a secret, and on its own it opens nothing. The person's sign in is what protects the data. The backend's
**secret** `API_KEY` (the scheduled NACTA upload) must never be put in the frontend, and must be a different
value from `VITE_API_KEY`.

**The flow**
1. Sign in, or request an account (password of at least 12 characters). Supabase may ask the person to confirm
   their email first.
2. A new account is **pending** and sees a waiting screen that updates by itself. An administrator approves
   or declines it on the **People** tab (administrators see a badge with the number waiting).
3. Approved people can screen applicants and see **their own** history. Administrators also see everyone's
   (with who ran each screening, or just their own), manage the lists and the NACTA file, and manage people.
4. Declining or approving takes effect on the person's very next action.

**Session handling**
- The session is kept in this browser (so a visit does not start with a sign in) and is cleared after
  **30 minutes without activity**, in any tab, including when the browser is reopened later.
- An expired token is refreshed and the request tried once more. If the backend still refuses it, the
  person is signed out with a message, not left on a broken page.
- A wrong `VITE_API_KEY` is reported as a setup problem (it is not the person's fault) and does not sign
  anyone out.
- If a required setting is missing, or `VITE_SUPABASE_PUBLISHABLE_KEY` holds a **secret** key, the app shows
  what to fix instead of a login, and never starts.

**Connection behaviour**
- `VITE_API_BASE_URL` may be given as a bare host, with `https://` or with a trailing slash. `/api` is added
  if missing.
- The server is woken while the person types their password. Reads are retried up to three times on
  temporary trouble (asleep, 502/503/504, a dropped connection), honouring the server's `Retry-After`.
- A screening is never retried. The server is woken first, and if a screening times out the error says it may
  still have finished and to check History.
- Every request carries an `X-Request-ID`, shown as the Reference on errors, so a timed out request can still
  be found in the server log.

**Browser protections** (`vercel.json`): a strict Content Security Policy (scripts only from this site; network
calls only to this site, `*.onrender.com` and `*.supabase.co`; no framing), `nosniff`, no referrer, HSTS and a
locked down Permissions-Policy. If your backend is on its own domain, add it to `connect-src` there.

## Public screens and addresses

## Project layout

```
src/
  App.jsx            routing between the public screens and the console
  api.js             all backend calls
  auth/              sign in state (AuthContext)
  components/        shared pieces: CaseReport, ErrorBanner, ConfirmDialog, dialogs, ui
  lib/               config, formatting, status helpers, navigation, idle timer
  pages/             one file per screen
    console/         the tabs shown once signed in: Screening, History, Monitoring, Lists, People
  __tests__/
```

Signed out, the app has three addresses (small history-based routing in `src/lib/nav.jsx`, no router library):

| Address | Screen |
|---|---|
| `/` | Landing page (`pages/LandingPage.jsx`, `landing.css`) |
| `/sign-in` | Sign in |
| `/request-access` | Request an account |

Signed in, there is one screen (the console) at `/`. Signing in moves the address back to `/`. Signing out, or a
session ending, lands on `/sign-in` so the message ("signed out after 30 minutes...") is seen. Unknown addresses go
to `/`. `vercel.json` already rewrites every path to `index.html`, so a reload or bookmark of `/sign-in` works.

The landing page follows the same rules as the rest of the app: system fonts, no web fonts, no remote images, no
CDN scripts (the Content Security Policy allows only this site's own files), and it makes no request to the backend.
`Landing.test.jsx` fails if a page element ever points off-site. The sample panel is labelled as an illustration; keep
the copy limited to what the app does.

## Setup checklist

Backend (Render): set `APP_API_KEY` (generate one: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`),
keep `API_KEY` as a different secret value, and redeploy. Frontend (Vercel) environment variables:

```
VITE_API_BASE_URL=https://<your-backend>.onrender.com
VITE_API_KEY=<the same value as APP_API_KEY>
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<the project's publishable key>
VITE_TURNSTILE_SITE_KEY=<the Cloudflare Turnstile site key, once CAPTCHA protection is on in Supabase>
```

Supabase dashboard (Authentication): add the deployed frontend address to **URL Configuration** (Site URL and
Redirect URLs) so the confirmation email links back to the app, turn on **Confirm email**, and set the minimum
password length to 12 (turn on leaked password protection if your plan has it).

**The first administrator.** Sign up in the app, then in the Supabase SQL editor:

```sql
update public.profiles set status = 'approved', role = 'admin' where email = 'you@example.com';
```

After that, administrators approve everyone else in the app.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit and component tests (vitest)
npm run build
```

In dev, Vite's proxy (see `vite.config.js`) forwards `/api` to a backend on
`localhost:8000`. Copy `.env.example` to `.env.local`, fill in `VITE_API_KEY` (any value), and start the backend with the
matching `APP_API_KEY=<that value> DATABASE_URL=... SUPABASE_URL=... uvicorn app.main:app`.
Then sign in through the app as usual.

## Deploying to Vercel

1. Push this folder as its own repo and import it into Vercel (it
   auto-detects Vite).
2. Set this environment variable (see `.env.example`):

   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com/api
   ```

   Without it the app calls `/api` on Vercel's own domain, which does not
   exist. Also set the other three variables listed under Setup checklist below. The dev proxy only works locally.
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
  an optional date of birth, nationality, CNIC, father's or husband's
  name and province. Each is used: date of birth, nationality, a father's name and province, are
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
sign in session is kept in `localStorage`).

None of this replaces a legal or compliance review before this is used with
real applicant data. It is a technical pass, not a sign-off.

### Turnstile (CAPTCHA protection)

Sign up and sign in go from the browser straight to Supabase Auth, so the human check is enforced by Supabase.
Do it in this order, so nobody is locked out in between:

1. Cloudflare dashboard, **Turnstile**: add a widget for the deployed address (and `localhost` for development).
   Copy the **Site key** and the **Secret key**.
2. Vercel: set `VITE_TURNSTILE_SITE_KEY` to the site key and redeploy. The sign in and request access forms now
   show the check and send its token. This is safe before Supabase asks for it: an unused token is ignored.
3. Supabase dashboard, **Authentication**, **Attack Protection**: turn on **Enable CAPTCHA protection**, choose
   **Cloudflare Turnstile** and paste the **Secret key**. From now on Supabase rejects a sign up, sign in or
   password reset without a valid token. The secret key lives in Supabase only, never in this app.

`vercel.json` allows `https://challenges.cloudflare.com` for scripts, frames and connections, which the widget needs.
If you change the Content Security Policy, keep those three entries. A token works once, so the form asks for a
fresh one after every attempt. Without `VITE_TURNSTILE_SITE_KEY` the check is not shown (use that only while
CAPTCHA protection is off in Supabase). Sessions that already exist are not affected.
