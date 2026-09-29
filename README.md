# Fahrtenbuch Automatisch – website

English marketing site, privacy policy, terms, support and imprint for the iOS app
[Fahrtenbuch Automatisch](https://apps.apple.com/us/app/fahrtenbuch-automatisch/id6816878055).
Live at **https://mileage.karaboga.dev**.

Plain static HTML/CSS served by nginx. No build step, no JavaScript, no cookies, no third-party requests
(the only exception is the owner-only [admin panel](#admin-panel), which is not linked from the site).

```
public/            web root – everything in here is served as is
  index.html       landing page
  privacy.html     /privacy   (App Store "Privacy Policy URL")
  terms.html       /terms
  support.html     /support   (App Store "Support URL")
  imprint.html     /imprint
  404.html
  admin/           /admin – RevenueCat admin panel (vanilla ES modules, basic auth, see below)
  assets/css/site.css
  assets/screens/  phone screenshots (generated)
  assets/img/      icon, App Store badge, og.jpg (generated)
design/            sources for the generated images
  screens/*.html   static English copies of the app design screens
  og.html          social preview image
scripts/render-screens.sh   design/ → public/assets (needs Chrome, cwebp, ImageMagick)
nginx.conf         clean URLs, caching, gzip, security headers, /healthz, /admin locations
docker/            admin-auth.conf (headers + CSP for /admin), 40-admin-auth.sh (builds the htpasswd at start)
Dockerfile
```

## Run locally

```sh
docker build -t mileage-web .
docker run --rm -p 8080:80 mileage-web
open http://localhost:8080
```

## Admin panel

`/admin` shows the Fahrtenbuch RevenueCat project (overview metrics, trend charts, customers with subscriptions and
purchases, configuration health) and can grant or revoke promotional premium for a customer.
There is no backend: the browser calls the RevenueCat REST API v2 directly.

Two locks protect it:

1. **nginx basic auth.** Set `ADMIN_USER` (letters, digits, `. _ @ -`) and `ADMIN_PASSWORD` as environment variables in
   Coolify. `docker/40-admin-auth.sh` hashes them (SHA-512 crypt) into `/etc/nginx/admin.htpasswd` when the container
   starts, so nothing secret is in the repo. Without both variables every `/admin` request gets a `401`. Use a long
   password: `/admin` is capped at 5 requests/s (burst 30, then `429`), but behind Coolify's proxy all clients share one
   address, so that cap is global rather than per visitor.
2. **RevenueCat secret key, typed into the panel.** It is held in memory only (no storage, cookie or URL), dropped on
   reload, on the *Lock* button and after 15 idle minutes. Create a dedicated v2 secret key for this project in
   RevenueCat → API keys. Read-only permissions are enough to browse; granting and revoking premium needs write access
   to customer information. Never commit or paste the key anywhere else.

`/admin` has its own CSP (`script-src 'self'`, `connect-src https://api.revenuecat.com`) and is sent with `noindex` and
`no-store`; every other route keeps the strict no-JavaScript CSP. Locally:

```sh
docker run --rm -p 8080:80 -e ADMIN_USER=owner -e ADMIN_PASSWORD=change-me mileage-web
open http://localhost:8080/admin
```

## Deploy with Coolify

1. **New Resource → Public/Private Repository** and pick this repo, branch `main`.
2. **Build Pack:** `Dockerfile` (base directory `/`, Dockerfile location `/Dockerfile`).
3. **Ports Exposes:** `80` (Coolify defaults to 3000, which gives a 502). If you change it after the app was
   created, also check **Container Labels** – the Traefik `loadbalancer.server.port` labels keep the old port
   until you click "Reset Labels to Coolify Default" (or edit them) and redeploy.
4. **Domains:** `https://mileage.karaboga.dev` – Coolify's proxy handles the certificate.
   Add an `A` record for `mileage.karaboga.dev` pointing at the Coolify server first.
5. **Health check** (optional – the image has its own `HEALTHCHECK`): path `/healthz`, port `80`.
6. **Environment variables** (only for the admin panel): `ADMIN_USER`, `ADMIN_PASSWORD`. Mark them as runtime-only.
7. Deploy. Enable auto-deploy on push if you like.

## App Store Connect

- Privacy Policy URL: `https://mileage.karaboga.dev/privacy`
- Support URL: `https://mileage.karaboga.dev/support`
- Marketing URL: `https://mileage.karaboga.dev`

In the app, set `LegalLinks.privacyPolicy` (`MileageTracker/UI/Paywall/PaywallView.swift`) to the privacy URL –
the paywall hides the link while it is `nil`.

## Updating the screenshots

Edit the HTML in `design/screens/`, then run `scripts/render-screens.sh`. The screens are static copies of the
design file with the app's data model in mind (UK English, miles, 55p/mi for 2026/27) – keep the text in line
with what the app really does.
