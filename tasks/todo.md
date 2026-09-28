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
