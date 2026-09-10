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

