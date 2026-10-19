# ColdReach Career Coach — Decision Record

Architectural and behavioural decisions, with the reasoning and the alternatives
that were rejected. Read this alongside `flow.md` (how data moves) and
`PROGRESS.md` (what is verified).

---

## D1 — Zero-build, single-directory static app

**Decision.** Four files in one folder. No package manager, no bundler, no
transpiler, no dev server, no dependency install.

**Why.** The brief forbids Node/npm/bundlers/build steps and requires that
double-clicking `index.html` is sufficient. A build pipeline would make the
project depend on tooling that will rot; plain files will still open in five
years.

**Rejected.** A Vite/Webpack setup (forbidden and unnecessary — there is no
dependency graph to manage beyond CDN globals); a single self-contained
`index.html` with inline `<style>`/`<script>` (would violate the brief's
separation of concerns and make the code harder to navigate); ES modules (would
require a server, breaking `file://`).

## D2 — Port the *behaviour*, not the code

**Decision.** The prior implementation at `D:\repos\coldReachFrontEnd` is React +
TypeScript. It was read as the authoritative source for domain logic — prompt
structure, JSON schema, rubric weights, validation rules, default instructions,
colour tokens — and then re-implemented in vanilla JS.

**Why.** The prior code cannot be reused directly: React and TypeScript are
prohibited and a build step would be required. But its behaviour had already been
though through, so re-deriving it would risk inventing a different product.

**Rejected.** Copying the TSX and stripping types (would still need JSX
transpilation); starting from scratch (would drift from the established schema
and prompt structure).

## D3 — One IIFE, organised into 19 numbered sections

**Decision.** `app.js` is a single immediately-invoked function expression with
numbered banner comments: config → state → dialog → element cache → theme → card
collapse → instructions → counters → custom fields → validation → builders →
rendering → actions → extraction → toasts → keyboard → bootstrap.

**Why.** No module system is available without a server. A single IIFE avoids
globals, keeps everything in closure scope, and gives one obvious place to look
for each concern. The numbered sections make a 2,000-line file navigable.

**Rejected.** Multiple `<script>` tags sharing a global namespace (fragile
load-order coupling, global leakage); class-based encapsulation (more ceremony
than the size warrants, and no test suite to justify it).

## D4 — Pinned CDN dependencies

**Decision.** Exact versions: Bootstrap 5.3.3, Bootstrap Icons 1.11.3, PDF.js
3.4.120 (+ the matching `pdf.worker.min.js`), Mammoth.js 1.6.0, Google Fonts
Inter. All URLs verified to return HTTP 200.

**Why.** The brief permits these libraries via CDN and forbids a package manager.
Pinning exact versions means the page today is the page next month.

**Rejected.** `@latest` URLs (breaks unpredictably); version ranges (same
problem, less obviously); self-hosting (better for security and offline use, but
the brief specifies CDN, and it would add ~1 MB of vendored files — documented as
the hardening path in `PRODUCTIONDEPLOY.md`).

**Consequence accepted.** The page makes requests to third parties. The README
states plainly that this is therefore **not** a fully offline application, and
that a compromised CDN would run code in the page.

**Detail.** The PDF.js worker URL in `app.js` is derived from
`APP_CONFIG.pdfjsVersion`, which must stay equal to the version in the
`index.html` script tag. PDF.js throws an opaque error when the worker version
mismatches, so making it configurable beats hard-coding it twice.

## D5 — JSON payload: baseline names plus three documented additions

**Decision.** The payload uses the brief's baseline property names
(`masterInstructions`, `recipient`, `candidate.resumeText`, `opportunity`,
`preferences`, `research`, `additionalContext`, `requestedOutputs`) and adds
exactly three things: `product`, `generatedAt` and a `disclosures` object.

**Why.** The baseline names are the contract with the downstream coach and were
preserved verbatim. The three additions are needed for honesty: the payload must
carry, *in machine-readable form*, the facts that all data is user-supplied, that
no research was performed, and that `null` means "unknown", not "absent".
`generatedAt` makes staleness diagnosable.

**Rejected.** Renaming fields to be more descriptive (would break compatibility);
omitting the disclosure block (would let a downstream tool silently imply
research was done); adding a `schemaVersion` field (nothing consumes it yet —
`product` already identifies the producer).

**Detail.** `JSON.stringify()` is used exclusively. JSON is never assembled by
string concatenation, so escaping is never a manual concern and the download can
always be re-parsed as a correctness check.

## D6 — Output mode semantics

**Decision.** "Complete Prompt" = the plain-text brief **plus** the JSON payload
appended under a banner. "Plain Text" = the brief only. "Structured JSON" = the
JSON only.

**Why.** "Complete" should mean the union of everything available. Splitting it
into two adjacent blocks lets a human read the brief and then hand the JSON to a
machine without switching tabs.

**Consequence.** The resume and job description appear twice in Complete Prompt
(once in the brief, once in the JSON). This is intentional and is called out in
the README so it is not mistaken for a bug.

**Rejected.** Making "Complete" mean only the brief (then it is not complete);
interleaving the JSON (unreadable).

## D7 — Download everything from current state, never from the screen

**Decision.** "Download JSON" builds from the **live form state**, not from
whatever the textarea currently displays, and re-parses its own output before
saving. It therefore produces valid JSON even when the "Plain Text" tab is
selected.

**Why.** A user who has just typed a correction and clicks Download JSON expects
that correction. Serialising the visible textarea would silently produce either
stale data or a file whose contents contradict its extension.

**Rejected.** Downloading the textarea contents (fragile and surprising).

## D8 — Staleness model: refresh silently, block loudly

**Decision.** After the first generation, any edit that is still valid rebuilds
the output automatically. An edit that makes a required value invalid keeps the
last good output on screen but marks it "Out of date", states why in the status
line, and **blocks** the download buttons with an explanatory toast.

**Why.** The alternative failure modes are both worse: silently refreshing after
an invalid edit would emit a payload built from broken input; silently keeping
stale output would let someone hand over data that no longer matches what they
typed. The chosen behaviour never lies about which of the two it is.

**Rejected.** Never auto-refreshing (constant manual regeneration); blocking
generation entirely on invalidity (loses work).

## D9 — Validation: four required recipient fields plus the resume, and nothing more

**Decision.** Generation is blocked only by: recipient full name, title, company,
email, and resume text. Every other field, including every field in Cards E–H, is
optional. Format checks (email, URLs, LinkedIn) apply **only to fields that were
filled in**, and are purely local shape checks — no request is ever made to
verify a URL.

**Why.** A user may legitimately want to draft an outreach brief without an
applicant-tracking link or a job description. Blocking on optional data would
make the tool refuse to do its job. Conversely, a malformed email address
guarantees a broken draft, so it is worth blocking on.

**Detail.** URL validation deliberately accepts bare hostnames
(`example.com/page`) as well as full URLs, because users paste both. It rejects
schemes that cannot be visited in this context, e.g. `ftp://`.

**Rejected.** Validating everything (blocks legitimate use); validating nothing
(lets clearly broken payloads through); making a network call to check a URL
(would leak data and break offline use — explicitly forbidden).

## D10 — A custom modal dialog instead of `window.confirm`

**Decision.** Reset, file replacement and file removal use a custom
`role="dialog" aria-modal="true"` dialog: focus moves to the confirm button, Tab
is trapped between the two buttons, Escape cancels, Shift+Tab works, and focus
returns to the trigger on close.

**Why.** `window.confirm` blocks the event loop, cannot be styled, cannot be
accessed consistently, cannot carry the detailed consequence text these actions
need ("this will replace text you have edited"), and its wording is browser-
controlled.

**Disclosure.** Focus is returned to whatever was focused when the dialog opened
(`appState.lastFocused`). Automation that calls `.click()` without focusing the
trigger first will observe focus returning to the previously focused element —
correct behaviour, not a defect.

## D11 — Persist the theme and nothing else

**Decision.** A single `localStorage` key, `coldreach.theme`, holding `dark` or
`light`. Everything else lives in memory for the lifetime of the page.

**Why.** The brief permits theme persistence and forbids storing personal
information. Every read/write is wrapped in `try/catch` because storage throws
outright in some privacy modes and in some `file://` configurations — a theme
preference must never be able to break the application.

**Rejected.** `sessionStorage` (adds no value over a variable); remembering form
data (explicitly forbidden); remembering the output mode (would be convenient but
is not worth a second key and the associated trust questions).

## D12 — Desktop application shell, after a real accessibility finding

**Decision.** On screens ≥992 px, `body` is exactly one viewport tall
(`height: 100vh; overflow: hidden`) and a flex column. The header, validation
strip, action toolbar and footer are fixed layout rows; the workspace takes the
remaining height; both columns stretch to it and scroll internally.

**Why.** The previous design used `position: sticky; bottom: 0` for the toolbar.
Lighthouse's `target-size` audit caught the toolbar transiently overlapping a
form control during its scroll-and-capture pass, and a geometry probe confirmed
the overlap is real (a sticky bar overlaying scrolling content always covers
something). The brief requires the toolbar not to obscure the form or the output.
A layout row that participates in flex cannot overlap anything — the requirement
becomes structurally impossible to violate rather than merely unlikely.

**Rejected.** Keeping the sticky bar and padding the bottom of the workspace
(padding only protects the *end* of the content, not the middle); `position:
fixed` (strictly worse — removes the element from flow entirely); accepting the
audit finding as a false positive (it was only *partly* an artefact).

**Regression risk, and how it was caught.** Both intermediate attempts were
caught by measurement, not by eye: (1) with only `min-height: 100%` on `body`
nothing was constrained and the workspace grew to 3,712 px; (2) once
constrained, flex shrinking squashed the input cards and clipped their contents
(the input column's `scrollHeight` collapsed from 3,712 px to 509 px). Fixes:
a desktop `height: 100vh` rule, and `flex: none` on `.cr-card` and the output
panel's fixed rows. See `LOG.md` Phase 5.

**Below 992 px** the shell is switched off: the page scrolls naturally as a
single column and the action area sits at the *end* of the content, so on mobile
it cannot cover the form either.

## D13 — Extracted text is always editable, and the textarea is the source of truth

**Decision.** PDF/DOCX/TXT extraction writes into the normal textarea. That text
is fully editable, and the textarea value — not the file — is what is sent.
Importing over an existing field asks for confirmation first, and warns
specifically when the existing text had been manually edited. Nothing is
truncated; a size warning appears past 32,000 characters.

**Why.** Extraction is lossy in ways the user can see and fix (line breaks,
ligatures, table order, headers/footers). Making the extracted text read-only or
implicitly authoritative would force users to accept artefacts they can plainly
see. Silently truncating a long resume would be the worst option of all: it would
produce a quietly incomplete payload.

**Rejected.** Read-only extracted text; OCR for scanned PDFs (out of scope for a
frontend-only build without a network OCR service — the app detects the
no-text-layer case and explains it instead); chunking or summarising long input
(invents structure and hides content).

## D14 — Fail loudly when a library is missing

**Decision.** If `window.pdfjsLib` or `window.mammoth` is undefined, the import
attempt reports exactly that, names the likely cause (offline or blocked CDN),
and tells the user to paste the text instead. It never fails silently and never
imports nothing while appearing to succeed.

**Why.** Verified behaviour, not a theoretical concern: with its library removed,
each path produced its specific message and left the textarea untouched, with
zero console noise. Users offline can still complete every part of the task.

## D15 — Disable the research-enabled mode rather than fake it

**Decision.** The research-mode `<select>` contains the "research-enabled" entry
but marks it `disabled`. "User-supplied information only" is the default and the
only selectable mode.

**Why.** There is no live research integration and none can exist in a
frontend-only build that must not transmit data. Offering the option and quietly
ignoring it would be a lie about the tool's capability; hiding the option
entirely would leave users wondering why their pasted research notes are not
being used.

**Consequence.** The prompt and the JSON `disclosures` block both state that no
research was performed and that URL fields are references the user typed, not
pages the tool read.

## D16 — Remove the unsaved-data warning on unload

**Decision.** No `beforeunload` handler.

**Why.** It was implemented and then removed deliberately. Because nothing is
persisted, every reload discards all input, so a warning would fire on nearly
every navigation and quickly become noise that users click through without
reading. Reloading is also a documented privacy feature here ("reload to clear").
The trade-off is explicit: predictability over a warning that cannot be trusted.

## D17 — A small test-only namespace

**Decision.** `window.ColdReach` exposes `buildPluginInput`, `buildJson`,
`collectFormData`, `validateForm`, `DEFAULT_INSTRUCTIONS` and `APP_CONFIG`.

**Why.** It made the schema, the validation rules and the default instructions
directly assertable from the automation driver rather than only through the UI,
which is the difference between "the button worked" and "the emitted JSON is
correct". It exposes no user data: the functions take the live form as input and
return what they build.

## D18 — Accessibility chosen as the default, not as a retrofit

**Decision.** Semantic `<button>`/`<label>`/`<section>` markup; the card headers
are real buttons with `aria-expanded`; the mode selector is a `tablist` with
Arrow/Home/End support; errors are linked with `aria-invalid` +
`aria-describedby` and mirrored into an `aria-live` summary; status and toasts
are live regions; a skip link is first in the tab order; `:focus-visible` styles
are defined for every control; `prefers-reduced-motion` is honoured.

**Why.** Retrofitting semantics onto `div`-based interaction is how accessibility
gets skipped. Result: **Lighthouse Accessibility 1.00, zero failing audits** on
the final build, after fixing two real findings (tertiary-text contrast, and two
unnamed file inputs).

**Detail.** The hidden file inputs carry both `aria-label` and `tabindex="-1"`:
they need an accessible name for the audit, and they must not be tab stops
because they are operated through the visible "browse your device" buttons.

## D19 — Work around Python's heuristic caching during verification

**Decision.** Each verification round is served from a **fresh port**, making a
new origin.

**Why.** `python -m http.server` sends no cache headers, so Chromium caches
`styles.css` heuristically and a plain reload served stale CSS — which produced a
Lighthouse run reporting contrast values that no longer existed on disk and
briefly looked like a failed fix. A new origin guarantees a cold cache. This is
a testing-methodology decision, not an application one; the application has no
caching requirements because it is normally opened from disk or a real host.

## D20 — Branch from `main` when the requested base branch did not exist

**Decision.** The request asked for a branch "from `ui-enchaned`". Neither a
local nor a remote branch of that (or any similarly spelled) name existed; the
repository had only `main`. Created **`ui-enhanced`** from `main` and told the
user, rather than failing, guessing at a commit, or silently inventing a base.

**Why.** Branching from a non-existent ref is not possible, and inventing history
would be worse than a one-word spelling correction. The branch name is the only
deviation; it is trivial to rename, and the work is isolated from `main`.

## D21 — Redesign the visual layer, keep the verified mechanics

**Decision.** The UI pass rewrites tokens, card chrome, header/toolbar styling and
adds presentational elements, but keeps the app-shell layout rules
(`100vh` + `overflow:hidden` on desktop, internally scrolling columns,
`flex:none` cards), every element id, and the whole data path.

**Why.** Behaviour had already been verified end-to-end. A structural rewrite
would have invalidated that evidence for no user benefit. Every new element was
added alongside the existing ids, and `app.js` only gained three additive
functions plus one state flag.

**Rejected.** Rebuilding the markup around a new grid; converting the output tabs
to a new component; replacing Bootstrap. All add risk without changing what the
user can do.

## D22 — Put progress in the page flow, not in a sticky overlay

**Decision.** The required-field meter is a normal card at the top of the input
column. It scrolls away with the form.

**Why.** A sticky bar inside the scrolling column would overlap card headers,
reintroducing exactly the `target-size` class of finding that forced the
app-shell rework. The meter is most useful before the user starts typing (to show
what is needed), and the per-card chips plus the output readiness pill carry the
state after that.

**Accessibility.** The track is a real `role="progressbar"` with
`aria-valuemin/max/now` and a human `aria-valuetext`; the visible "2 of 5" and
the missing-field sentence are plain text, so the information survives even if a
screen reader ignores the bar.

## D23 — Keep the validation summary quiet until Generate

**Decision.** The red "missing or invalid inputs" strip is hidden on first load
and appears only after a Generate attempt (`appState.validationRequested`).

**Why.** A blank page covered in red reads as "you have done something wrong"
before the user has done anything. The new progress card already says what is
missing, in a neutral voice. Field-level errors still appear on Generate exactly
as before.

**Trade-off.** The strip no longer acts as a live checklist; the progress card
takes over that job, and it is always accurate because it is recomputed inside
`updateReadiness()`.

## D24 — Two light-theme accent colours, not one

**Decision.** Light theme uses `#0e7490` for accent text and a `#0e7490 -> #155e75`
gradient for the primary button; dark theme keeps the bright `#22d3ee`.

**Why.** The bright cyan is right on charcoal and wrong on white: white text on
`#0891b2` measured **3.68:1**. The original Lighthouse run only exercised dark
mode, so the failure was invisible until a per-pair sweep was run in both themes.
Text and fill colours are now tracked separately (`--cr-accent`,
`--cr-accent-strong`, `--cr-accent-hover`, `--cr-accent-contrast`) so a theme can
darken one without dulling the other.
