# Fahrtenbuch Automatisch – English website

Domain: https://mileage.karaboga.dev · App: https://apps.apple.com/us/app/fahrtenbuch-automatisch/id6816878055
Stack: static HTML/CSS served by nginx (Docker, deployed with Coolify). No build step, no JS framework, no cookies, no analytics.

## Plan
- [x] `design/screens/` – static English (UK) copies of the design board screens (dc runtime stripped, `{{theme}}` resolved,
      German screens translated, 45p→55p and "motion + GPS"→"CarPlay + GPS" fixed to match the app)
- [x] `scripts/render-screens.sh` – headless Chrome @3x → `public/assets/screens/*.webp` (reproducible mockups)
- [x] `public/assets/css/site.css` – one stylesheet, app tokens (teal #0B6B74 / #3FC1C9), light + dark
- [x] `public/index.html` – hero + App Store badge, features, how it works (Shortcut setup), regions, privacy, Free vs Pro, CTA
- [x] `public/privacy/` – Privacy Policy (GDPR; on-device SwiftData, location, Apple Maps, RevenueCat, no tracking, website)
- [x] `public/terms/` – Terms of Use (Apple standard EULA + subscription terms + "not tax advice")
- [x] `public/support/` – Support + FAQ + contact
- [x] `public/imprint/` – Imprint / Impressum
- [x] `public/404.html`, `robots.txt`, `sitemap.xml`, favicon/app icon, OG image, Apple Smart App Banner
- [x] `Dockerfile` + `nginx.conf` + `.dockerignore` – nginx:alpine, clean URLs, cache + security headers, gzip, healthcheck
- [x] `README.md` – Coolify deploy steps
- [x] Verify: `docker build` + `docker run`, curl every route (200/404, headers), screenshots desktop + mobile, light + dark

## Review
- Live at https://mileage.karaboga.dev (Coolify). 502 fixed: Ports Exposes 3000→80 plus the stale Traefik port labels.
- Tech review: only finding was the CSS cache map key → `~text/css` (live already sent no-cache; made robust).
- Fact-check vs app code: no contradicted claims. Open: set `LegalLinks.privacyPolicy`/`termsOfUse` in the app to
  /privacy and /terms; confirm the 7-day trial in App Store Connect; drop the "English coming" FAQ once shipped.
- Screens corrected vs design: UK rate 45p→55p (TaxRegion), "motion + GPS"→"CarPlay + GPS" (no CoreMotion).

---

# Admin panel (`/admin`) – RevenueCat, project Fahrtenbuch (`projb556e19e`)

Decisions: no backend; browser calls RevenueCat REST API v2 directly (CORS verified: `api.revenuecat.com` echoes the
site origin, allows authorization + content-type). Vanilla ES modules, no build, hand-drawn inline SVG charts.
Secret key is typed into the panel, kept **in memory only** (never storage, never in the repo). nginx basic auth in front.

## Plan
- [x] `public/admin/index.html` – shell: login (key field), tabs Overview / Customers / Config; `noindex`, no third-party requests
- [x] `public/admin/admin.css` – reuses site tokens (teal, light + dark), tables, cards, dialog
- [x] `public/admin/js/api.js` – fetch wrapper (Bearer, pagination, error + rate-limit handling, 401 → lock), key held in a closure; `dom.js` helpers
- [x] `public/admin/js/overview.js` – `/metrics/overview` cards + `/charts/{name}` series (revenue, active subs, trials, churn) → `charts.js`
- [x] `public/admin/js/customers.js` – list/search, detail (subscriptions, entitlements, purchases), promotional grant (1w/1m/1y/lifetime)
      + revoke, confirm dialog (errors shown inline, no success toast – the view just reloads)
- [x] `public/admin/js/config.js` – products, entitlements, offerings, webhooks health view
- [x] Key hygiene: `type=password`, `autocomplete=off`, idle auto-lock (15 min) wipes key, "Lock" button, `Referrer-Policy: no-referrer`
- [x] nginx: `location ^~ /admin/` with `auth_basic`, own CSP (`script-src 'self'; connect-src https://api.revenuecat.com`),
      security headers repeated (add_header is not inherited), `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`
- [x] Basic auth credentials from env `ADMIN_USER` / `ADMIN_PASSWORD` (Coolify) via `/docker-entrypoint.d/` script → `.htpasswd`
      generated at start; **fails closed** (no env → 401 for everyone). No hash in the repo.
- [x] README: admin section (env vars, key scope, how to lock down); note public site stays JS-free
- [x] Verify: docker build/run, 401 without auth, 200 with, CSP on `/admin/` only, public routes unchanged, read the live
      API with a real key (overview, customers, one grant + revoke on a test customer), light/dark + mobile screenshots

## Review
- Server side verified in Docker: no env → 401 everywhere under /admin; wrong password 401; correct 200 (also with `:`/`$` in the
  password); `/admin/` and `/admin/index.html` redirect to `/admin`; public routes and their CSP unchanged; htpasswd is 640 root:nginx.
- Client verified in headless Chrome: real page under the /admin CSP loads, a bad key gets a real 401 from api.revenuecat.com
  (CORS + connect-src OK, no CSP violations); UI screens (dark, 1200px + 500px) and grant/revoke flows checked against a mocked fetch:
  correct endpoints, bodies, confirm dialog, cancel makes no call, credentials omitted, no referrer.
- Endpoint paths and field names checked against the RevenueCat docs and MCP output (customers, products, entitlements, offerings).
- **Not verified with a real key** (none available to me): chart payloads for `trial_conversion_rate`/`churn` from REST, and an actual
  grant/revoke against production. "Lifetime" grants expire in 100 years – confirm RevenueCat accepts that on the first real use.
- Lesson kept in mind: `.checks` already existed in site.css (landing page) – admin classes must not reuse site class names.

## Quality review (3 reviewers) – outcome
- Fixed: `next_page` resolved via `new URL` (absolute or `/v2/…`); Configuration tab renders into its own box (late response no longer
  wipes another tab); search / "Load more" responses are discarded when a newer search started; open confirm dialog is closed on lock;
  grant/revoke buttons disabled while in flight and errors replace each other; key input `autocomplete="new-password"`;
  `.btn` font override, `.section-head` class clash with site.css (→ `.panel-head`), clipped tab focus ring; SHA-512 htpasswd,
  `limit_req` on /admin, JS gzip; shared `table()` / `load()` helpers, `usd`→`formatValue`, dead classes removed.
- Pre-existing site bug fixed in the same change: open redirect in the `.html` and trailing-slash redirects (`/%5Cevil.com.html` →
  `Location: /\evil.com`, read by browsers as `//evil.com`). `rewrite` does **not** escape it (a reviewer claimed it did – tested,
  it does not); redirects now only accept `[A-Za-z0-9._~/-]`, everything else 404s.
- Not done (deliberate): accessibility pass (tabs pattern, focus after re-render, chart contrast/labels), CSS card/pill merging,
  per-entitlement revoke (needs `list-subscription-entitlements` calls; the API rejects a non-promotional revoke harmlessly and the
  error is shown).
- Lesson: don't trust a comment or a reviewer claim about nginx escaping – curl it. Reused site.css class names (`.checks`,
  `.section-head`) twice; grep site.css before naming admin classes.
