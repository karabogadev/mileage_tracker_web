# Fahrtenbuch Automatisch – English website

Domain: https://mileage.karaboga.dev · App: https://apps.apple.com/us/app/fahrtenbuch-automatisch/id6816878055
Stack: static HTML/CSS served by nginx (Docker, deployed with Coolify). No build step, no JS framework, no cookies, no analytics.

## Plan
- [ ] `design/screens/` – static English (UK) copies of the design board screens (dc runtime stripped, `{{theme}}` resolved,
      German screens translated, 45p→55p and "motion + GPS"→"CarPlay + GPS" fixed to match the app)
- [ ] `scripts/render-screens.sh` – headless Chrome @3x → `public/assets/screens/*.webp` (reproducible mockups)
- [ ] `public/assets/css/site.css` – one stylesheet, app tokens (teal #0B6B74 / #3FC1C9), light + dark
- [ ] `public/index.html` – hero + App Store badge, features, how it works (Shortcut setup), regions, privacy, Free vs Pro, CTA
- [ ] `public/privacy/` – Privacy Policy (GDPR; on-device SwiftData, location, Apple Maps, RevenueCat, no tracking, website)
- [ ] `public/terms/` – Terms of Use (Apple standard EULA + subscription terms + "not tax advice")
- [ ] `public/support/` – Support + FAQ + contact
- [ ] `public/imprint/` – Imprint / Impressum
- [ ] `public/404.html`, `robots.txt`, `sitemap.xml`, favicon/app icon, OG image, Apple Smart App Banner
- [ ] `Dockerfile` + `nginx.conf` + `.dockerignore` – nginx:alpine, clean URLs, cache + security headers, gzip, healthcheck
- [ ] `README.md` – Coolify deploy steps
- [ ] Verify: `docker build` + `docker run`, curl every route (200/404, headers), screenshots desktop + mobile, light + dark

## Review
