# ColdReach Career Coach — Production Deployment

**Status: NOT DONE. Nothing in this document has been performed.** There is no
host, no domain, no HTTPS configuration, no security headers, no SRI, no CSP, no
CI, no monitoring and no self-hosted dependency. This is the *plan* for turning
the current build into a hardened public deployment, together with an honest
account of what each step buys and what still remains.

For the plain "how do I put these four files somewhere" path, see `deploy.md`.
This document is the hardened version.

---

## 1. Why this needs its own document

The application has an unusually small attack surface — no backend, no database,
no accounts, no server-side secrets, no data ever leaving the device. But it has
two properties that a normal production checklist has to address:

1. **It executes third-party code from public CDNs at runtime.** Those scripts
   run with full privileges in the page. A compromised CDN is a compromised app.
2. **It handles the most sensitive document a person owns** — their resume — plus
   a contact's name and email. It never transmits them, which is the whole point,
   but the deployment must not accidentally undermine that (no analytics beacons,
   no error reporters, no service worker caching personal data).

Everything below addresses one of those two, or the ordinary "serve static files
well" concerns.

---

## 2. Threat model

| # | Threat | Current state | Mitigation |
|---|--------|---------------|------------|
| T1 | A CDN is compromised or a pinned version is silently modified, injecting script that reads the form and exfiltrates it. | Vulnerable by construction. Exact versions are pinned, which prevents *accidental* drift but not a hostile CDN or a mutated artifact. | Self-host the libraries (§3) and/or add SRI (§4). CSP (§5) limits where exfiltration can even go. |
| T2 | A MITM alters the CDN response. | Vulnerable on plain HTTP. | HTTPS (**mandatory**) + SRI. |
| T3 | Malicious content reaches the page and executes. | Not reachable through normal use: the app has no server, no shared/user-generated content, and never builds HTML from input (all writes are `textContent`; zero `innerHTML`). The only "content" is what the user types. | CSP as defence in depth. |
| T4 | Personal data leaks to a third party. | Not possible in the current build — no analytics, no telemetry, no AI calls, no form data in any request, theme-only storage. | Preserve this invariant. Review any future addition against it. |
| T5 | Data persists on a shared/public computer. | Form data lives only in tab memory and dies on reload/close. But: **Copy places the payload on the system clipboard**, and **Download writes a file to disk**. Both outlive the tab. | Document it; the UI already offers Reset Entire Form; a "clear clipboard" habit is the user's part. |
| T6 | A browser extension with page access reads the form. | Out of scope for any web app; unavoidable in principle. | Note it in the privacy copy. |
| T7 | A denial-of-service / resource exhaustion from a huge file. | Guarded: 10 MB cap, enforced before reading; typed error. | Keep the cap. Consider streaming if raised. |
| T8 | Stale cached assets serve a broken mix after an update. | Not an issue today (no build, no hashing). | Set explicit cache headers (§7) and consider `?v=` query strings on `styles.css` / `app.js` at release time. |

---

## 3. Step 1 — Self-host the dependencies

**Why first.** This is the single largest risk reduction: it removes T1 and T2
entirely, removes the "must be online" caveat, makes the app genuinely offline
capable, and is a precondition for a strict CSP with `'self'` only.

**What to vendor.**

| File | Purpose | Approx. size |
|------|---------|--------------|
| `bootstrap.min.css` (5.3.3) | Grid, utilities, base components | ~230 KB |
| `bootstrap.bundle.min.js` (5.3.3) | *(see note)* | ~80 KB |
| `bootstrap-icons.min.css` (1.11.3) | Icon font CSS | ~100 KB |
| `fonts/bootstrap-icons.woff2` + `.woff` | Icon glyphs | ~130 KB |
| Inter `woff2` files (400/500/600/700) | Typography | ~4 × 40 KB |
| `pdf.min.js` (3.4.120) | PDF text extraction | ~340 KB |
| `pdf.worker.min.js` (3.4.120) | PDF parsing worker | ~1.1 MB |
| `mammoth.browser.min.js` (1.6.0) | DOCX text extraction | ~120 KB |

Total: roughly 2.3 MB, all static and all cacheable.

**Layout.**

```
coldreach/
  ├─ index.html
  ├─ styles.css
  ├─ app.js
  ├─ README.txt
  ├─ vendor/
  │   ├─ bootstrap/   bootstrap.min.css, bootstrap.bundle.min.js
  │   ├─ bootstrap-icons/  bootstrap-icons.min.css, fonts/*.woff2
  │   ├─ pdfjs/       pdf.min.js, pdf.worker.min.js
  │   ├─ mammoth/     mammoth.browser.min.js
  │   └─ fonts/inter/ inter-*.woff2, inter.css
  └─ (dev docs)
```

**Code changes required.**

1. `index.html`: rewrite the five CDN `<link>`/`<script>` `href`/`src` values to
   the local `vendor/...` paths. Delete the two `fonts.googleapis.com` /
   `fonts.gstatic.com` preconnects and point at the local `inter.css`.
2. `app.js`: change the PDF.js worker source. It is built as
   `"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + APP_CONFIG.pdfjsVersion + "/pdf.worker.min.js"`.
   For a self-hosted build, set `APP_CONFIG.pdfjsVersion` usage aside and point
   at `"vendor/pdfjs/pdf.worker.min.js"`. **Keep the worker and the main library
   on the identical version** — a mismatch is the classic PDF.js breakage.
3. Add a repository `LICENSE`/`NOTICE` recording the upstream licences
   (MIT/Apache-2.0 for Bootstrap, Apache-2.0 for PDF.js, BSD-2-Clause for
   Mammoth, OFL for Inter and Bootstrap Icons).

**Note on the Bootstrap JS bundle.** The application does not depend on any
Bootstrap JS component — every interaction (cards, tabs, dialog, toasts, drop
zones) is implemented directly in `app.js`. The bundle is a leftover convenience.
Verify with a smoke test, then **delete the script tag**: it removes a
dependency, a download and attack surface for no functional cost.

**Verify after vendoring.**
- DevTools → Network: with the network throttled to Offline, the page must still
  render fully and import PDF/DOCX/TXT.
- DevTools → Network: **zero** external requests.
- No console errors.

---

## 4. Step 2 — Subresource Integrity (if you keep any CDN)

If any dependency stays remote, add SRI plus `crossorigin="anonymous"` so a
mutated file is refused by the browser.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"
        integrity="sha384-…"
        crossorigin="anonymous" defer></script>
```

Generate the hashes yourself from the exact bytes you intend to ship:

```powershell
# PowerShell — generate an SRI hash for a local copy of the file
$bytes = [IO.File]::ReadAllBytes("pdf.min.js")
$sha   = [Security.Cryptography.SHA384]::Create().ComputeHash($bytes)
"sha384-" + [Convert]::ToBase64String($sha)
```

**Caveats to be explicit about:**
- Google Fonts' CSS2 endpoint returns **different CSS depending on the browser's
  User-Agent**, so it cannot carry a stable SRI hash. Full SRI coverage therefore
  requires self-hosting the font as well (§3).
- SRI does not protect against a compromised *build* — only against a changed
  byte sequence after you hashed it.
- Add SRI hashes to the pre-release checklist so they are regenerated whenever a
  version is bumped.

---

## 5. Step 3 — Content-Security-Policy

Serve a `Content-Security-Policy` header (preferred) or `<meta http-equiv>` tag.
The header is stronger; `<meta>` cannot express `frame-ancestors` or `report-uri`.

### Policy A — current CDN build

The app needs: its own origin; `css`/`js`/fonts from jsdelivr and cdnjs; CSS from
Google Fonts; font binaries from gstatic and jsdelivr; a web worker from cdnjs;
and `blob:` for the download and the PDF.js worker fallback.

```
Content-Security-Policy:
  default-src 'none';
  script-src  'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;
  style-src   'self' https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline';
  font-src    'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:;
  img-src     'self' data:;
  connect-src 'none';
  worker-src  'self' blob: https://cdnjs.cloudflare.com;
  child-src   blob:;
  manifest-src 'none';
  object-src  'none';
  frame-src   'none';
  frame-ancestors 'none';
  base-uri    'none';
  form-action 'none';
  upgrade-insecure-requests;
```

Notes on the non-obvious entries:

- **`connect-src 'none'`** is the headline control for this app: it guarantees in
  the browser itself that the page cannot POST form data to a collector, even if
  something were injected. The app never calls `fetch`/`XHR`, so nothing breaks.
- **`font-src ... data:`** — Bootstrap Icons and some font stacks embed `data:`
  URIs.
- **Google Fonts CSS cannot have SRI** (see §4), which is why `style-src` lists
  `fonts.googleapis.com` and `font-src` lists `fonts.gstatic.com`.
- **`worker-src ... blob:`** — PDF.js may fall back to a blob-backed worker when a
  cross-origin worker is refused.
- **`'unsafe-inline'` in `style-src`** is required *initially* because the legacy
  clipboard fallback path assigns three inline style properties to a temporary
  off-screen textarea (`position`, `top`, `opacity`). There are **zero**
  `style="…"` attributes in `index.html` and no `<style>` blocks, so once that
  fallback is validated under a strict policy you can drop `'unsafe-inline'`. If
  it is dropped and the browser does block those CSSOM writes, the visual effect
  is limited to that off-screen textarea briefly appearing mid-page during the
  clipboard fallback — test it, then decide.
- **`form-action 'none'`** — the app contains a `<form>` used only for input
  grouping; it must never submit anywhere.
- **`base-uri 'none'`** — prevents a `<base>` tag from retargeting relative asset
  paths.
- **`upgrade-insecure-requests`** — forces any accidental `http://` subresource
  to HTTPS.

Also set an HTTP header for a first pass, then a `<meta>` fallback if you cannot
control headers.

### Policy B — self-hosted build (recommended)

```
Content-Security-Policy:
  default-src 'none';
  script-src  'self';
  style-src   'self' 'unsafe-inline';
  font-src    'self' data:;
  img-src     'self' data:;
  connect-src 'none';
  worker-src  'self' blob:;
  object-src  'none';
  frame-ancestors 'none';
  base-uri    'none';
  form-action 'none';
  upgrade-insecure-requests;
```

This is the version worth aiming for: no third-party origins at all.

### Roll it out safely

1. Serve as `Content-Security-Policy-Report-Only` first (with a `report-uri` you
   actually read, or just the console) and exercise **every** feature: theme
   toggle, all three output modes, copy (success and forced failure), both
   downloads, TXT/DOCX/PDF import via picker and via drop, oversized and
   unsupported rejections, clear, reset, dialog Escape/Tab.
2. Fix any legitimate violation by adjusting the policy or the code — **never**
   by adding `'unsafe-eval'` or widening `connect-src`.
3. Switch to the enforcing header.

---

## 6. Step 4 — Transport and other security headers

| Header | Value | Why |
|--------|-------|-----|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HTTPS only, no downgrade. Only after HTTPS is rock-solid. |
| `X-Content-Type-Options` | `nosniff` | Stops MIME sniffing on the static assets. |
| `Referrer-Policy` | `no-referrer` | The app has no outbound links carrying data; belt and braces. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), usb=(), payment=()` | The app needs none of these. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolation. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevents your assets being embedded elsewhere. |
| `X-Frame-Options` | `DENY` | Clickjacking; redundant with `frame-ancestors 'none'` but universally supported. |
| `Cache-Control` | see §7 | Correct caching for static assets. |

Do **not** add `Access-Control-Allow-Origin: *`.

**HTTPS is mandatory**, not optional: without it, an active network attacker can
rewrite both the app and its CDN dependencies in flight. GitHub Pages,
Cloudflare Pages, Netlify and Vercel all provide certificates automatically.

---

## 7. Step 5 — Caching and asset versioning

Because there is no build step, there are no content-hashed filenames. Choose one:

**Option 1 (simple, recommended for now).** Long-lived caching with explicit
revalidation:

```
index.html    Cache-Control: no-cache
styles.css    Cache-Control: public, max-age=604800, must-revalidate
app.js        Cache-Control: public, max-age=604800, must-revalidate
vendor/**     Cache-Control: public, max-age=31536000, immutable
```

**Option 2 (better).** Append a version query at release time and cache
`styles.css` / `app.js` aggressively:

```html
<link rel="stylesheet" href="styles.css?v=1.0.0" />
<script src="app.js?v=1.0.0" defer></script>
```

Then `Cache-Control: public, max-age=31536000, immutable` for those files, and
`no-cache` for `index.html`.

> Whatever you choose, do **not** serve `vendor/**` with `no-cache`: the PDF.js
> worker alone is over a megabyte and would be re-downloaded on every visit.

---

## 8. Step 6 — Privacy posture and user-facing copy

The deployment should state plainly what the application does, because the
application's honesty is part of its value. A short policy page or a section in
the README/footer should say:

> Your resume, job description and all form entries stay in your browser tab.
> This tool does not send them anywhere: there is no server, no account, no
> analytics, no AI service and no research service. Closing or reloading the tab
> discards everything. Only your light/dark theme preference is remembered on
> this device.
>
> Two things do leave the tab by design, and both are actions you take:
> **Copy** puts the generated text on your system clipboard, and **Download**
> saves a file to your device.
>
> This tool assembles a request package for a career-coaching tool of your
> choosing. It does not generate advice, does not research anyone, and does not
> contact anyone.

If any third-party hosting analytics is ever enabled (e.g. a host's privacy-
friendly page-view counter), it must be disclosed and must never receive form
values — and it should be checked against the requirement that this application
performs no analytics.

---

## 9. Step 7 — Monitoring, error reporting, updates

**Do not add** crash reporting that captures form values, session recording,
heat-mapping, or `fetch`-based error beacons. Each would break the core privacy
promise.

| Need | Privacy-safe approach |
|------|-----------------------|
| Availability | External uptime ping of the URL only. No page content. |
| Errors | Users report them via the author's GitHub issues. The app logs nothing. |
| Usage | Use host-level aggregate request counts. Do not instrument the page. |
| Dependency updates | A scheduled manual check. Bump the pinned version, regenerate SRI hashes, re-run the smoke test. |
| Dependency vulnerability alerts | GitHub Dependabot alerts on the vendored files' upstreams. |

**Update procedure**

1. Read the upstream changelog for the library being bumped.
2. Download the new file; vendor it (or update the pinned CDN URL **and** the SRI
   hash).
3. If PDF.js changed: update both `pdf.min.js` and `pdf.worker.min.js` and
   `APP_CONFIG.pdfjsVersion` **together**.
4. Re-run the post-deployment smoke test (`deploy.md` §5) end to end.
5. Re-run Lighthouse; Accessibility must stay at 1.00 with zero failing audits.
6. Bump the asset version query / `APP_CONFIG` version marker.
7. Commit, deploy, re-verify on the live URL.

---

## 10. Step 8 — Accessibility and quality gates for production

| Gate | Threshold | Current |
|------|-----------|---------|
| Lighthouse Accessibility | 1.00, zero failing audits | ✅ 1.00, zero failures (Chromium, HTTP) |
| Lighthouse Best Practices | 1.00 | ✅ 1.00 |
| Lighthouse SEO | 1.00 | ✅ 1.00 |
| Keyboard-only operation of every control | manual pass | ⚠️ machine verification blocked; logic verified via dispatched events |
| axe DevTools in a second engine | 0 serious/critical | ⚠️ not run |
| No console errors on any path | 0 errors | ✅ verified |
| No horizontal overflow at 320–1440 px | 0 | ✅ verified at 390 px; 320 px not yet tested |
| 200% zoom usable | manual | ⚠️ not tested |
| Reduced motion honoured | honoured | ✅ implemented |

An automated 1.00 is not a substitute for a manual screen-reader and
keyboard-only pass. Neither has been done yet.

---

## 11. Go-live checklist

Every row is currently **NOT STARTED**; the "current" column states what exists
today so the gap is unambiguous.

| # | Step | Status |
|---|------|--------|
| 1 | Complete the P1 manual `file://` test (`PROGRESS.md` §7) | ⛔ NOT DONE |
| 2 | Complete the P1 manual keyboard-only walkthrough | ⛔ NOT DONE |
| 3 | Test in Firefox and Safari | ⛔ NOT DONE |
| 4 | Vendor the dependencies and remove the Bootstrap JS bundle | ⛔ NOT DONE |
| 5 | Or: add SRI to every remaining CDN asset (self-host the font for full coverage) | ⛔ NOT DONE |
| 6 | Pick a host and create the project (recommended: GitHub Pages) | ⛔ NOT DONE |
| 7 | `git init`, first commit, push | ✅ DONE — repo `denziljosteve/cold-email-prompt-frontend-standalone`, branch `main`, commit `19810c0` |
| 8 | Enable HTTPS (automatic on GitHub Pages / Cloudflare / Netlify) | ⛔ NOT DONE |
| 9 | Configure security headers, including CSP (§5, §6) | ⛔ NOT DONE |
| 10 | Set cache headers / asset versioning (§7) | ⛔ NOT DONE |
| 11 | Publish the privacy statement (§8) | ⛔ NOT DONE |
| 12 | Run the live post-deployment smoke test (`deploy.md` §5) | ⛔ NOT DONE |
| 13 | Re-run Lighthouse against the deployed URL | ⛔ NOT DONE |
| 14 | Record the release (version, date, dependency versions, hash) | ⛔ NOT DONE |

**No step in this table has been executed.**

---

## 12. Release record template

```
Release:        ColdReach Career Coach v1.0.0
Date:           YYYY-MM-DD
URL:            https://…
Commit:         <sha>
Files:          index.html styles.css app.js README.txt (+ vendor/)
Dependencies:   Bootstrap 5.3.3 (self-hosted)
                Bootstrap Icons 1.11.3 (self-hosted)
                PDF.js 3.4.120 (self-hosted, worker matched)
                Mammoth 1.6.0 (self-hosted)
                Inter (self-hosted, OFL)
Security:       HTTPS ✓  CSP ✓ (Policy B)  HSTS ✓  nosniff ✓
                Referrer-Policy ✓  Permissions-Policy ✓
                SRI: n/a (self-hosted)
Verification:   Lighthouse a11y 1.00 / BP 1.00 / SEO 1.00
                Manual file:// smoke test ✓ (<browser>, <os>)
                Manual keyboard pass ✓
                Engines tested: Chromium …, Firefox …, Safari …
Known gaps:     <list, or "none">
Rollback:       redeploy commit <previous sha>
```

---

## 13. Rollback

No server state exists, so rollback is a file replacement:

1. **git-based host:** revert to the previous commit / re-point Pages at it.
2. **Upload-based host:** re-upload the previous four files (plus `vendor/`).
3. **No cache purge required** if you used versioned asset queries; otherwise
   purge `index.html` only (the HTML controls which asset versions load).
4. **No data restore, ever** — no user data is stored server-side, by design.

Estimated time: under five minutes, and it is byte-identical to the previous
release because there is no build step.

---

## 14. What "production ready" would mean here

The application is **feature-complete and passing a 100 accessibility audit**,
and it has a genuinely strong privacy story that comes from its architecture
rather than from promises: there is no server to breach, no database to leak,
and no network path for the data to travel. The remaining work is therefore
concentrated in two places:

1. **Verification gaps** (items 1–3 of the go-live checklist): the manual
   `file://` test, the manual keyboard pass, and cross-engine testing. These are
   cheap, and they are the difference between "should work" and "does work".
2. **Supply-chain hardening** (items 4–5): self-hosting the dependencies is the
   single highest-value change left, because it removes the only third-party code
   execution path and makes `connect-src 'none'` fully enforceable.

Everything else — headers, caching, hosting, HTTPS — is routine static-site
configuration.
