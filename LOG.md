# ColdReach Career Coach — Development Log

Chronological record of building, testing, fixing and documenting this project.
Times are local (UTC+04:00) on 2026-10-19. The early phase times are approximate;
from 13:43 onward they are anchored to recorded file and artefact timestamps,
which are listed here so the timeline can be checked:

| Anchor | Timestamp |
|--------|-----------|
| `app.js` final write | 13:43:25 |
| `index.html` final write (Lighthouse `label` fix) | 13:51:19 |
| `styles.css` final write (app-shell rework) | 13:56:24 |
| Final end-to-end download JSON `generatedAt` | 2026-10-19T09:57:53.923Z → 13:57:53 |
| `README.txt` written | 14:00:11 |
| `LOG.md` / `PROGRESS.md` / `decision.md` / `flow.md` / `deploy.md` / `PRODUCTIONDEPLOY.md` | 14:01:24 → 14:04:43 |

**Session summary:** built a standalone, frontend-only prompt builder from an
empty directory, verified it in a real browser, fixed the eight defects that
verification surfaced, audited it with Lighthouse, and wrote the documentation.
Nothing was deployed.

---

## Phase 0 — Reconnaissance (≈13:18–13:26)

| Time  | Event |
|-------|-------|
| 13:18 | Inspected the working directory `D:\repos\coldEmailFrontEnd_Standalone`. It was **empty** and **not** a git repository. No reference HTML was present in it. |
| 13:20 | Located two usable references elsewhere on disk: `D:\repos\jobPromptMaker\index.html` (visual/structural reference: Bootstrap 5 cards plus PDF.js/Mammoth import patterns) and `D:\repos\coldReachFrontEnd` (a prior React/TypeScript implementation holding the real domain logic: prompt builder, JSON schema, validation rules, file extraction, default instructions, design tokens). |
| 13:23 | Read the reference modules that define behaviour: `src/lib/promptBuilder.ts`, `src/lib/jsonSchema.ts`, `src/lib/fileExtraction.ts`, `src/lib/validation.ts`, `src/lib/download.ts`, `src/config/defaultInstructions.ts`, `src/types/careerCoach.ts`, `src/styles/app.css`. Confirmed the required JSON property names, the 100-point rubric weights (30/25/20/15/10), the seven required output sections, and the master-instruction text. |
| 13:26 | Noted that the prior implementation is React + TypeScript and therefore **cannot** be reused as-is: React/TS and build steps are forbidden. Decision: port the *behaviour and design* into plain HTML/CSS/vanilla JS, not the code (see `decision.md` D2). |

## Phase 1 — Skeleton and design system (≈13:27–13:37)

| Time  | Event |
|-------|-------|
| 13:27 | Created `index.html`: 8 input cards (A–H), the output panel, the bottom action toolbar, the confirmation dialog, the toast region, the footer, and pinned CDN script/link tags. |
| 13:30 | Created `styles.css`: CSS custom-property token set, dark theme (default) + light theme, charcoal/slate palette with cyan accents, Inter typography, two-column desktop grid, responsive breakpoints, `:focus-visible` styles, reduced-motion rules. |
| 13:33 | Created `app.js` as a single IIFE organised into 19 numbered sections: config, state, element cache, theme, card collapse, instructions lock/include/reset, character counters, custom-field visibility, validation, prompt/JSON builders, output rendering, actions (generate/copy/download/clear/reset), file import and extraction, dialog, toasts, keyboard handling, bootstrap. |
| 13:36 | Verified all five CDN URLs plus the Google Fonts URL return HTTP 200, and pinned exact versions (pdf.js 3.4.120 with the matching worker, Mammoth 1.6.0, Bootstrap 5.3.3, Bootstrap Icons 1.11.3). |

## Phase 2 — First real-browser run (≈13:38–13:40)

| Time  | Event |
|-------|-------|
| 13:38 | Started a local static server (`python -m http.server 8137 --bind 127.0.0.1`) because the available browser automation refuses `file://` URLs. |
| 13:39 | **Clean load confirmed:** zero console messages, all 8 cards present, 0 inline event handlers, `pdfjsLib` / `mammoth` / `bootstrap` / Inter all loaded, 6 toolbar buttons, the output textarea read-only, the "research-enabled" option `disabled`, `localStorage` empty on a fresh profile. |

## Phase 3 — Defect fixing from inspection (≈13:40–13:43)

| Time  | Event |
|-------|-------|
| 13:40 | **Defect 1 — the resume field had no inline error element.** `handleGenerate` set `aria-invalid` on the resume textarea for an empty resume, but Card D had no `<p class="cr-error">` target, so the required-error count resolved to 5 `aria-invalid` versus 4 visible messages. Fixed by adding `<p class="cr-error" id="err-resumeText">` and registering `resumeText: "err-resumeText"` in `FIELD_IDS`. Re-verified in the browser: 5 visible errors = 5 `aria-invalid`. |
| 13:41 | **Defect 2 — Card E was missing a field.** The brief lists "any additional context about the hiring situation" under Target Opportunity. Added `opportunityHiringContext` (textarea + label + optional badge) and wired it into collection and both builders. |
| 13:42 | **Defect 3 — `setReadiness()` rewrote `innerHTML` on every keystroke.** Rewrote it to toggle a class and write `textContent` only when the state actually changes, using a dedicated `<i>` icon element (`outputReadinessIcon`). This also removed the last `innerHTML` use that contained markup. |
| 13:43 | `app.js` final write for this phase. |

## Phase 4 — Functional verification over HTTP, port 8137 (≈13:43–13:51)

| Time  | Event |
|-------|-------|
| 13:43 | **Downloads (first round):** the browser captured `ColdReach_Plugin_Input.txt` (17,603 B, `text/plain`) and `ColdReach_Plugin_Input.json` (7,432 B, `application/json`). Both were read back from disk and verified; the JSON mirrored the live form state. |
| 13:44 | **Theme:** dark↔light via real driver clicks; label, icon and `aria-pressed` correct; computed light background `rgb(241,245,249)`; persisted as the single key `coldreach.theme`. |
| 13:44 | **Privacy:** entered data including `SECRET-MARKER-*` sentinels, then reloaded. All form data gone; only `coldreach.theme` remained; `sessionStorage` empty. |
| 13:45 | **Card A:** counter read "4,693 characters"; field locked/read-only; unlock → edit → re-lock preserved the edited text; reset-to-default restored 4,693 characters and re-locked. |
| 13:45 | **Validation:** an empty submit produced 5 visible errors, 5 `aria-invalid`, the summary strip, focus on `recipientFullName`, an empty output, and 4 toasts. Invalid email, invalid LinkedIn URL, `ftp://` company site and a malformed portfolio each produced an inline error and blocked generation. |
| 13:46 | **Generation:** Complete Prompt = 17,577 characters; all 7 required sections present; the rubric line present; resume and job-description sentinels byte-intact; no `...`; no warnings. |
| 13:46 | **JSON:** parses; all spec key groups present; `resumeText` and `jobDescription` byte-identical to source; `null` for absent optionals; `requestedOutputs` correct; `disclosures` present. |
| 13:46 | **Plain Text:** shorter, no JSON banner, still contains the master instructions, resume and job description intact, `[Not provided]` markers present. |
| 13:47 | **Include/exclude:** excluding the master instructions kept the text on screen but omitted it from the payload (reported as "excluded by the user"). |
| 13:47 | **Staleness:** an edit auto-refreshed the output with the new value; clearing the required email flipped the pill to "Out of date", printed an explicit status message, left the output unchanged and blocked downloads with an honest toast. |
| 13:47 | **Copy:** reported "Copied 17,585 characters to the clipboard." |
| 13:48 | **Clear Optional Inputs:** kept the 4 required recipient fields, the resume text, the instructions and their lock state, and the output; cleared candidate/opportunity/research/additional and reset preferences to defaults; the custom-objective field hid again. |
| 13:48 | **Reset:** the dialog required confirmation; **Escape cancelled with data preserved**; Tab cycled between the two buttons; confirming restored defaults, cleared all personal data, output and file chips, set the pill to "Not generated", returned the mode to Complete Prompt and expanded all cards. |
| 13:49 | **File import:** TXT via the picker (95 B → resume text, status + chip, job description untouched, output auto-refreshed); DOCX via drop into the job-description zone (81 characters extracted, chip showed 1.6 KB); PDF via drop into the job-description zone (657 B → 82 characters of correct text, chip, resume untouched). Replacing a field that already had content raised the confirmation dialog with correct wording; cancelling preserved the existing content. |
| 13:49 | **Rejection paths** (all showed `cr-status-error` and preserved content): `empty.txt` → "That file is empty (0 bytes)…"; `notes.csv` → `Unsupported file type "text/csv"…`; `scanned.pdf` → a one-page explanation that a text layer is required (OCR); `fake.docx` → a corrupt-DOCX-archive message. |
| 13:50 | **Limits:** an 11 MB file was exercised with an in-page synthetic `DataTransfer` drop (the automation harness caps transfers at 5 MiB) → correct size-limit error. A multi-file drop warned and imported only the first file. The `dragging` class applied on `dragover` and cleared on `drop`. |
| 13:50 | **Locked instructions:** the automation driver's `fill` refused the field ("Target is not an enabled editable text field"), confirming read-only enforcement at the browser level. |
| 13:50 | **Network:** the only requests were the document, `styles.css`, `app.js`, the 5 CDN assets and Google Fonts. No XHR/fetch, no analytics, no AI calls. |
| 13:50 | **Responsive:** verified in a same-origin 375 px iframe — single-column grid, static output, collapsed `grid-2`, hidden subtitle, wrapping toolbar with 50 %-basis buttons, no horizontal overflow. |
| 13:51 | **Copy failure path:** with `writeText` forced to reject and `execCommand` forced to return false, the UI reported "Copy failed — the browser denied clipboard access…" and never claimed success. |
| 13:51 | **Console:** the only output observed anywhere was PDF.js's internal info line "Warning: Indexing all PDF objects" — a library message containing no personal data. |

## Phase 5 — Accessibility audit and layout rework (13:51–13:56)

| Time  | Event |
|-------|-------|
| 13:51 | Recorded that `tools.browser.press` stopped delivering key events to the page (a probe listener saw `keys: []`), including in a brand-new focused tab. Earlier in the session driver keys **had** worked for the dialog Escape/Tab tests, so the behaviour was inconsistent. Decision: verify keyboard behaviour by dispatching genuine `KeyboardEvent` objects to the focused controls, and list a manual keyboard pass as outstanding. |
| 13:51 | **Dialog keyboard logic confirmed** via dispatched events: `initial=confirmOkBtn` → Tab → `confirmCancelBtn` → Tab → `confirmOkBtn` → Shift+Tab → `confirmCancelBtn`; Escape closed the dialog. |
| 13:51 | **Library-fallback behaviour confirmed:** with `window.pdfjsLib` deleted, a PDF import reported "PDF.js is not available (the pinned CDN script did not load, usually because the browser is offline or the CDN is blocked). Paste your PDF text manually instead." With `window.mammoth` deleted, a DOCX import reported the equivalent Mammoth message. Neither touched the textarea. Zero console output. |
| 13:51 | **First Lighthouse run: Accessibility 0.88**, Best Practices 1.00, SEO 1.00. Failing audits: `color-contrast`, `label`, `target-size`. |
| 13:51 | **Fix — labels (Defect 5).** The two visually hidden `<input type="file">` elements had no accessible name. Added `aria-label` to each plus `tabindex="-1"` (they are operated through the visible "browse your device" buttons). The `label` audit cleared. This is the `index.html` write at 13:51:19. |
| 13:52 | **Fix — contrast (Defect 4).** `--cr-text-faint` was `#64748b`, giving ratios as low as 2.37:1 on the optional-badge background. Dark theme changed to `--cr-text-dim: #c2cddc` / `--cr-text-faint: #a0aec4`; light theme `--cr-text-faint` changed to `#4f5c6e`; the optional-badge background was softened from `rgba(148,163,184,0.14)` to `0.10`. |
| 13:53 | Discovered that a plain reload was serving the **cached** `styles.css` (the contrast values reported by the audit were unchanged) while the document itself was revalidated. Worked around it by serving the folder from a fresh port — a new origin — for each verification round. This is a Python `http.server` heuristic-caching artefact, not an application issue (see `decision.md` D19). |
| 13:53 | **Second Lighthouse run (fresh origin): Accessibility 0.97.** Contrast and label failures gone; only `target-size` remained, reporting the research-mode `<select>` as "partially obscured (525.2px by 14.1px)". |
| 13:54 | Investigated the `target-size` finding (Defect 6). Measured geometry showed the select fully inside its container at audit time (`visibleHeightInsideContainer: 31` of 31 px). Re-running Lighthouse immediately after `scrollIntoView({block:"center"})` gave **Accessibility 1.00 with zero failures** — proving the finding was an artefact of Lighthouse's own scroll-and-capture pass, during which the sticky bottom toolbar transiently overlapped the control. |
| 13:54 | Concluded the transient overlap was still a genuine (if minor) compliance gap against "the toolbar must not obscure the form or output", and reworked the desktop layout into a proper **application shell**. |
| 13:55 | **Layout rework:** `body` became a full-height flex column on desktop (≥992 px, `height:100vh; overflow:hidden`); the header, validation strip, toolbar and footer became fixed layout rows; `.cr-workspace` takes the remaining height with `min-height:0`; both columns stretch to that height and scroll internally; `.cr-output` lost its sticky positioning and `.cr-output-textarea` became `flex:1; resize:none`. |
| 13:55 | **Regression caught by measurement (Defect 7):** the first shell attempt did not constrain anything — the workspace was 3,712 px tall — because `body` only had `min-height:100%`. Added the desktop `height:100vh` rule. |
| 13:56 | **Second regression caught by measurement (Defect 8):** the input cards were being squashed by flex shrinking (each card compressed to fit, clipping its contents — the input column's `scrollHeight` collapsed from 3,712 px to 509 px). Fixed by adding `flex: none` to `.cr-card` and to the output panel's fixed rows. Re-measured: column `scrollHeight` 3,712 against a 509 px height → scrolls internally; **no card clipped**; last card and last field fully reachable after scrolling. This is the `styles.css` write at 13:56:24. |
| 13:56 | Re-measured the shell: viewport 1000×700; header 0–52; columns 64–573; toolbar 585–638 (fully in viewport, no overlap with either column); footer 638–700; page scroll locked (`window.scrollY` stayed 0 while the column scrolled to 300); no page scrollbar. |
| 13:56 | **Third Lighthouse run (fresh origin): Accessibility 1.00, Best Practices 1.00, SEO 1.00, zero failures.** |
| 13:56 | Re-verified the mobile layout in a 390 px same-origin iframe (inner 375 px): single column (351 px), `grid-2` collapsed (325 px), input column `overflow: visible` and not internally scrolled, output auto-height, **toolbar `static` and not overlapping**, buttons two-up at 173×35 px, subtitle hidden, page scrolls naturally, no horizontal overflow. |
| 13:56 | Attempted screenshots for the record; `browser.screenshot` requires a visible desktop window that was not available in this environment, so **no screenshots were captured**. Recorded as an honest gap. |

## Phase 6 — Final end-to-end regression on the reworked layout (13:57–13:58)

| Time  | Event |
|-------|-------|
| 13:57 | Full end-to-end pass on the rebuilt shell (fresh origin, port 8142): filled all eight cards (including every optional field, both custom-option reveals, the toggles and the long-text fields), generated, and checked all three output modes. **Complete Prompt** 19,069 characters with the banner, exact resume and job-description text, the rubric line and all seven sections. **Structured JSON** parsed; top keys `product, generatedAt, masterInstructions, recipient, candidate, opportunity, preferences, research, additionalContext, requestedOutputs, disclosures`; `resumeExact: true`; `jdExact: true`; `requestedOutputs` = the seven identifiers; `disclosures.researchPerformed: false`. Zero console messages. |
| 13:57 | Captured the downloads again on the rebuilt layout: `ColdReach_Plugin_Input.json` (8,502 B) and `ColdReach_Plugin_Input.txt` (19,091 B). Read the JSON back from disk: parses; `product = ColdReach Career Coach`; `generatedAt = 2026-10-19T09:57:53.923Z`; `requestedOutputs` = the seven identifiers; `preferences.length = detailed`; `candidate.resumeText` 226 chars; `opportunity.jobDescription` 105 chars; `recipient.companyWebsite` is `null`; `candidate.portfolioUrl` preserved; `disclosures.researchPerformed = false`; `masterInstructions.included = true`; `masterInstructions.text` 4,693 chars. |
| 13:57 | Re-ran **Clear Optional Inputs** on the rebuilt layout: kept `Priya Raman / Director of Data / Northwind Analytics / priya.raman@northwind.example`, the 224-character resume, the 4,693-character instructions and their lock; cleared candidate, opportunity, research, additional and recipient-optional fields; reset preferences to `explore_opportunities / professional_direct / standard / English` with toggles `true,false,false`; kept research mode `provided_information_only`; kept the output and refreshed it without the cleared values; produced the explanatory toast. |
| 13:58 | Re-ran **Reset** on the rebuilt layout: the dialog opened with the correct title; cancel left everything unchanged; confirming cleared the recipient fields, resume and job description, restored `DEFAULT_INSTRUCTIONS` (4,693 chars) and re-locked them with the include toggle checked, restored preference defaults, cleared the output to 0 characters and reset the pill to "Not generated" with the mode back to Complete Prompt. Zero console messages throughout. |
| 13:58 | **Static security sweep** of `app.js`: no `eval(`, `new Function`, `innerHTML`, `outerHTML`, `document.write`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or any `console.*` call. `localStorage` appears only in four theme-related lines. `index.html` contains **0** inline event handlers and **0** inline `style` attributes. The only external URLs are the 5 CDN assets, the 2 Google Fonts hosts, and author/placeholder links. |

## Phase 7 — Documentation (13:59–14:05)

| Time  | Event |
|-------|-------|
| 14:00 | Wrote `README.txt` (425 lines): usage, the eight cards, the output format, privacy and security, dependencies, troubleshooting, verification summary, author. |
| 14:01 | Wrote `LOG.md` (this file) and `PROGRESS.md`. |
| 14:02 | Wrote `decision.md` (D1–D19) and `flow.md` (architecture, load, state, journeys, builders, import, actions, section map, event map, theming, privacy). |
| 14:03 | Wrote `deploy.md`. |
| 14:04 | Wrote `PRODUCTIONDEPLOY.md`. |
| 14:05 | **Documentation correction:** the first drafts of `README.txt` and the dev docs quoted line counts from an unreliable shell count (705/1,075/366). Re-measured with a byte-level line count and corrected them everywhere to 748 (`index.html`), 1,244 (`styles.css`), 1,993 (`app.js`). The development log's late-phase timestamps were also reconciled against recorded file mtimes, which compress the audit/doc work into 13:51–14:08 rather than the later times first written. |
| 14:07 | **Documentation verified against the code, and three further inaccuracies corrected.** (a) Theming uses `data-bs-theme` on `<html>` (Bootstrap 5.3's colour-mode attribute), not `data-theme` on `<body>`; `flow.md` was corrected, and it now also records that the theme is written to `localStorage` only on toggle, not on first load. (b) The documented `appState` shape was invented rather than read; it was replaced with the real object from `app.js` line 102. (c) Validation runs on Generate, not live — typing only clears that field's error — so the README and the journey diagram were corrected. Additionally, the documented JSON structure was confirmed field-by-field against `buildJson()` output. |
| 14:08 | Stopped all seven local static servers (ports 8137–8143). |

## Phase 8 — Version control and publishing the source (14:09–14:20)

| Time  | Event |
|-------|-------|
| 14:09 | Confirmed the environment: git 2.54.0.windows.1, author identity configured (`Denzil Josteve Fernandes`, `denziljosteve@gmail.com`). |
| 14:10 | `git init` in `D:\repos\coldEmailFrontEnd_Standalone`; staged all 10 files (4 application files + 6 development docs). |
| 14:11 | Root commit `19810c0` — "ColdReach Career Coach: standalone frontend-only prompt builder" — 10 files, 6,174 insertions. |
| 14:12 | Added remote `origin` = `https://github.com/denziljosteve/cold-email-prompt-frontend-standalone.git`; renamed the branch to `main`. |
| 14:12 | Verified the remote was reachable and empty (`git ls-remote --heads origin` → no refs, exit 0; credentials supplied by the configured Git Credential Manager). |
| 14:12 | `git push -u origin main` succeeded: `* [new branch] main -> main`, and `git ls-remote --heads origin` now reports `19810c0… refs/heads/main`. |
| 14:13 | **Corrected the documentation, which had been written before the repository existed.** `deploy.md` (the "not a git repository" note and the GitHub Pages command block), `PRODUCTIONDEPLOY.md` (go-live checklist item 7, now DONE) and this log were all updated to state that the source is published while the *application* remains undeployed. |
| 14:13 | Confirmed GitHub Pages is **not** enabled, so the application is still not served from any host. Noted the subpath URL that Pages would use, and that the app's relative asset paths would work from it unchanged. |

---

## Defects found and fixed in this session

| # | Defect | Found by | Fix |
|---|--------|----------|-----|
| 1 | The resume textarea could be marked `aria-invalid` with no inline error element, so error and `aria-invalid` counts disagreed. | Source inspection, then confirmed in the browser. | Added `<p class="cr-error" id="err-resumeText">` and registered it in `FIELD_IDS`. |
| 2 | Card E lacked the "additional hiring context" field required by the brief. | Requirement review against the markup. | Added `opportunityHiringContext` and wired it through collection and both builders. |
| 3 | `setReadiness()` rewrote `innerHTML` on every keystroke. | Code review. | Class toggle + `textContent`, with a stable icon element id. |
| 4 | Low-contrast tertiary text (2.37:1 to 3.75:1) — an accessibility failure. | Lighthouse `color-contrast`. | Raised the dark and light `--cr-text-faint` / `--cr-text-dim` tokens and softened the optional-badge background. |
| 5 | Two visually hidden file inputs had no accessible name — an accessibility failure. | Lighthouse `label`. | Added `aria-label` (plus `tabindex="-1"`). |
| 6 | The sticky bottom toolbar could transiently overlap form content. | Lighthouse `target-size` plus geometry probes. | Rebuilt the desktop layout as an app shell, so the toolbar is a real layout row that cannot overlap content. |
| 7 | App-shell attempt 1: the body only had `min-height:100%`, so nothing was constrained and the workspace grew to 3,712 px. | Geometry probe. | Added a desktop-only `body { height: 100vh; overflow: hidden }` rule. |
| 8 | App-shell attempt 2: flex shrinking squashed the input cards, clipping their contents. | Geometry probe (`scrollHeight` collapsed to 509 px). | Added `flex: none` to `.cr-card` and the output panel's fixed rows. |
| 9 | Documentation drifted from the code: wrong line counts; a log timeline later than the recorded file mtimes; theming described as `data-theme` on `<body>` when it is `data-bs-theme` on `<html>`; an invented `appState` shape; and validation described as live when it only runs on Generate. | Self-review during documentation, checked against the filesystem and the source. | Re-measured counts at byte level; reconciled the timeline against file mtimes and the download JSON's `generatedAt`; read `app.js` and replaced every inaccurate claim, then confirmed the documented JSON structure field-by-field against `buildJson()` output. |

---

## Things deliberately *not* done

- No live research integration; the "research-enabled" option is **disabled** rather than faked.
- No OCR; image-only PDFs are rejected with an explanation.
- No `beforeunload` warning (implemented, then removed for predictability — see `decision.md` D16).
- No `localStorage` of anything except the theme.
- No deployment. The source is published to a public GitHub repository, but no
  host serves the application. See `deploy.md` and `PRODUCTIONDEPLOY.md`.
- No screenshot evidence (the screenshot tool required a visible desktop window).

## Known gaps carried forward

- `file://` (double-click) launch could not be automated — the browser tooling rejects non-HTTP(S) URLs. **P1 manual test.**
- Hardware-level key injection stopped working mid-session, so keyboard behaviour was verified with dispatched `KeyboardEvent`s rather than real key presses. **P1 manual keyboard pass.**
- The automation harness caps file transfers at 5 MiB, so the 10 MB limit was exercised with a synthetic in-page drop.
- Only Chromium was available; Firefox and Safari are untested.
