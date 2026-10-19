# ColdReach Career Coach — Deployment Guide

**Current deployment status: NOT DEPLOYED.** Nothing has been published to any
host, domain, CDN or app store. This document describes how to deploy the project
if and when that is wanted, plus exactly how to run it locally today.

`deploy.md` covers the *practical* path (get it working somewhere useful).
`PRODUCTIONDEPLOY.md` covers the *hardened* path (security headers, self-hosting
the dependencies, caching, monitoring).

---

## 1. What the artifact actually is

A deployment of this project is:

```
coldreach/
  ├─ index.html     789 lines
  ├─ styles.css   1,749 lines
  ├─ app.js       2,094 lines
  └─ README.txt  (documentation)
```

That is the whole thing. There is:

- no build step (files are deployed as written),
- no package manager or lockfile,
- no server-side runtime, database, queue or cron job,
- no environment variables, secrets or API keys,
- no service worker, no manifest, no install step,
- no `.htaccess`/web.config requirement.

**Nothing is generated, minified or hashed at deploy time.** Whatever you copy is
what runs. This is a deliberate property of the build (see `decision.md` D1): the
same four files open correctly from a USB stick and from an HTTPS host.

### Runtime network dependencies

The page loads these from third parties at runtime:

| Asset | Version | Host |
|-------|---------|------|
| Bootstrap CSS + JS bundle | 5.3.3 | `cdn.jsdelivr.net` |
| Bootstrap Icons | 1.11.3 | `cdn.jsdelivr.net` |
| Inter (Google Fonts) | CSS2 API | `fonts.googleapis.com`, `fonts.gstatic.com` |
| PDF.js (+ worker) | 3.4.120 | `cdnjs.cloudflare.com` |
| Mammoth.js | 1.6.0 | `cdnjs.cloudflare.com` |

Consequences for deployment:

- The host must be reachable over the public internet for full functionality, or
  the user's own egress must not block those domains.
- An air-gapped deployment needs the libraries vendored locally; that is the
  self-hosting recipe in `PRODUCTIONDEPLOY.md`.
- The application degrades without them: styling/icons/font are cosmetic, and
  PDF/DOCX import reports its specific "library is not available" message while
  the rest of the tool keeps working.

---

## 2. Local use (no deployment needed)

### Option A — double-click (the primary intended workflow)

1. Put the four files in one folder.
2. Double-click `index.html`.

No terminal, no server. See the README for the `file://` notes (clipboard
restrictions and the PDF.js worker fallback).

> **Verification status:** this exact path could **not** be automated in this
> environment — the available browser automation refuses `file://` URLs. It is a
> P1 manual test in `PROGRESS.md`. Until that test is done, treat "works from
> disk" as *by design and by code reading*, not as *observed*.

### Option B — local static server (used for all automated verification)

```powershell
# from the folder containing index.html
python -m http.server 8000 --bind 127.0.0.1
# then open http://127.0.0.1:8000/
```

Any static server works (`npx serve` is forbidden here only because npm is out of
scope — it is not part of the application). Use a **new port per test round** if
you are re-testing after editing CSS: `python -m http.server` sends no cache
headers and browsers cache heuristically, which produced a misleading Lighthouse
result during development (see `decision.md` D19).

---

## 3. Static hosting options

All of these are valid because the artifact is pure static files. Nothing below
has been performed.

| Host | How | Notes |
|------|-----|-------|
| **GitHub Pages** | Push the folder to a repo, enable Pages on the branch/root | Matches the author's existing `denziljosteve.github.io` setup. Free, HTTPS by default. Best fit for a personal portfolio project. |
| **Cloudflare Pages / Netlify / Vercel** | Connect a repo, set build command **empty**, publish directory `.` | No build command must be left blank — do not let the platform inject one. Instant HTTPS. |
| **Any static web host / S3+CloudFront** | Upload the four files | Set the entry document to `index.html`. |
| **Intranet file share** | Copy the folder | Works from `file://` semantics; same caveats as Option A. |

### Recommended: GitHub Pages

The repository has already been created and pushed (see the note below), so only
the Pages step remains:

```powershell
# already done:
#   cd D:\repos\coldEmailFrontEnd_Standalone
#   git init
#   git add .            # 10 files: 4 app + 6 dev docs
#   git commit -m "ColdReach Career Coach: standalone frontend-only prompt builder"
#   git branch -M main
#   git remote add origin https://github.com/denziljosteve/cold-email-prompt-frontend-standalone.git
#   git push -u origin main

# still to do — enable Pages:
#   repo Settings → Pages → Source: "Deploy from a branch" → main / (root)
```

> **Note:** the working directory **is** now a git repository with one commit
> (`19810c0`), pushed to
> `https://github.com/denziljosteve/cold-email-prompt-frontend-standalone`
> on branch `main`. The repository is **public source code only** — GitHub Pages
> is **not** enabled, and the application is therefore still **not deployed**.
> No file has been served from a web host.

> **If Pages is enabled later**, the app would be served at
> `https://denziljosteve.github.io/cold-email-prompt-frontend-standalone/` — note
> the subpath. The app uses only relative asset paths, so it works from a
> subpath without changes. Re-run the post-deployment smoke test (§5) afterwards.

---

## 4. Pre-deployment checklist

- [ ] All four application files present in one directory, no other local
      dependencies.
- [ ] `index.html` references `styles.css` and `app.js` by relative path.
- [ ] Every CDN URL returns HTTP 200 (re-check; CDN versions can be withdrawn).
- [ ] `APP_CONFIG.pdfjsVersion` in `app.js` equals the PDF.js version in the
      `index.html` script tag.
- [ ] No secrets, tokens or credentials anywhere (there are none by design —
      confirm anyway).
- [ ] A P1 manual `file://` smoke test has actually been performed in at least
      one browser after the final edit (currently **outstanding**).
- [ ] Generate → Copy → Download TXT/JSON verified on the exact files being
      deployed.
- [ ] Lighthouse run on the deployed URL or on the final local build.
- [ ] If serving over HTTPS: consider the CSP and self-hosting steps in
      `PRODUCTIONDEPLOY.md`.

---

## 5. Post-deployment smoke test

Run this against the live URL. It takes about two minutes.

1. **Load** — page renders styled, dark theme, eight cards, no console errors.
2. **Cards** — expand and collapse each; the last one (H) opens.
3. **Validation** — press Generate with an empty form; expect inline errors, a
   summary strip, and focus jumping to the contact-name field.
4. **Generate** — fill name/title/company/email and paste a resume; Generate →
   pill reads "Generated", output is populated.
5. **Modes** — switch through Complete / JSON / Plain Text; counts change, the
   textarea stays read-only.
6. **Downloads** — Download TXT and Download JSON; open the JSON and confirm it
   parses and matches what you typed.
7. **Imports** — import a TEXT resume (and a PDF/DOCX if you have one); confirm
   the chip shows the file name and the text lands in the textarea.
8. **Privacy** — enter a distinctive marker, reload, confirm it is gone;
   devtools → Application → Local Storage shows only `coldreach.theme`; devtools
   → Network shows no requests carrying your data.
9. **Reset** — Reset Entire Form, confirm the dialog, verify defaults return.
10. **Theme** — toggle dark/light and reload to confirm it persists.
11. **Console** — check for errors; expect none (PDF.js may log its own internal
    "Indexing all PDF objects" info line when parsing a PDF — that is the library,
    not the app).

---

## 6. Rolling back

There is no state to migrate, so a rollback is a file replacement:

- **GitHub Pages / git-based hosts:** `git revert` or redeploy the previous
  commit, or re-point Pages at the previous commit.
- **Upload-based hosts:** re-upload the previous four files. Because there is no
  build step, a rollback is byte-identical to the previous release.
- **Local/user copies:** any older copy of the folder still works.

No user data exists on any server to restore, because no server ever received
any. Users' form data lives only in their own browser tab and is discarded on
reload.

---

## 7. Things that must never be added without revisiting the requirements

- A backend or database that receives resume/job-description content — it would
  break the "no network transmission of form data" requirement.
- An AI API call — forbidden, and it would break the "this tool produces no
  advice" honesty position.
- Analytics or error reporting that captures form values — forbidden.
- `localStorage`/`sessionStorage` of anything beyond the theme — forbidden.
- Live research/scraping — forbidden; the "research-enabled" option is disabled
  on purpose and must stay that way unless a genuinely compliant design replaces
  it.
- A build step or framework — forbidden by the brief.
