# ColdReach Career Coach — Flow & Architecture

How the application is structured and how data moves through it. Written to
match the implementation in `index.html`, `styles.css` and `app.js`.

---

## 1. Architecture at a glance

```
                       ┌──────────────────────────────────────────┐
                       │            index.html  (748 lines)       │
                       │  semantic markup, no inline handlers,    │
                       │  pinned CDN <link>/<script> tags         │
                       └──────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
        ┌───────────▼────────────┐                 ┌────────────▼────────────┐
        │   styles.css (1,244)   │                 │    app.js  (1,993)      │
        │  tokens → themes →     │                 │  single IIFE,           │
        │  app shell → cards →   │                 │  19 numbered sections,  │
        │  output → toolbar →    │                 │  80 functions           │
        │  responsive            │                 │                         │
        └────────────────────────┘                 └────────────┬────────────┘
                                                                │
                                     ┌──────────────────────────┴─────────────────┐
                                     │  External globals (CDN, optional at runtime)│
                                     │  pdfjsLib · mammoth · bootstrap             │
                                     │  Each guarded: if absent → honest message   │
                                     └────────────────────────────────────────────┘
```

**Layers.** There are three, and they only touch through the DOM:

1. **Markup** — static structure, ids and `data-*` hooks. No behaviour.
2. **Styling** — CSS custom properties, `html[data-bs-theme]` for theming, media
   queries for the responsive switch.
3. **Behaviour** — `app.js`, which owns all state and all interaction.

There is no framework, no router, no template engine, no virtual DOM. Rendering
is direct DOM writes to a fixed set of cached elements.

### The three files in detail

- **`index.html`** — header (title, theme toggle), skip link, validation summary
  strip, `main.cr-workspace` containing `form.cr-inputs` (the 8 cards) and
  `aside.cr-output` (the output panel), the toolbar, the confirmation dialog
  backdrop, the toast region, and the footer.
- **`styles.css`** — design tokens; the `[data-bs-theme="dark"]` (default) and
  `[data-bs-theme="light"]` variable sets, set on `<html>`; the desktop app shell; card and control
  styling; the output panel; the toolbar; the dialog; toasts; and three media
  query blocks (≤991.98 px, ≤767.98 px, ≤575.98 px).
- **`app.js`** — everything else (see §9 for the section map).

---

## 2. Load and initialisation

```
DOMContentLoaded
      │
      ├─ initializeTheme()
      │     read localStorage["coldreach.theme"]  (try/catch)
      │     no stored value → "dark"
      │     applyTheme() → html[data-bs-theme] + aria-pressed, label, icon
      │                   (no storage write on first load; see §11)
      │
      ├─ cacheElements()          → every element looked up once, stored on `el`
      │
      ├─ initializeDependencies() → PDF.js global + worker src from APP_CONFIG
      │                             (skips silently if pdfjsLib is absent)
      │
      ├─ bindEvents()             → addEventListener for every control
      │                             (no inline handlers anywhere)
      │
      ├─ applyDefaults()          → preferences, research mode, card states
      ├─ renderInstructions()     → DEFAULT_INSTRUCTIONS into the locked textarea
      ├─ updateCustomFieldVisibility()
      ├─ updateCharacterCounts()
      ├─ updateReadiness()        → pill shows "Not generated"
      └─ expandAllCards()
```

Nothing is fetched. Nothing is read from storage except the theme. `app.js`
contains **zero** `fetch`, `XMLHttpRequest`, `console.*` and `innerHTML` calls.

---

## 3. State

All mutable state lives in one object in the IIFE closure (`appState`, `app.js`
line 102). Its shape as implemented:

```js
appState = {
  instructions:  { locked: true, included: true },  // Card A state
  resume:        { extractedText: "", fileName: null, fileSize: null },
  jobDescription:{ extractedText: "", fileName: null, fileSize: null },
  outputMode:    "complete",   // "complete" | "json" | "text"
  built:         null,         // { text, json, complete } from the last valid build
  hasGenerated:  false,        // has anything ever been generated?
  outputIsCurrent: false,      // does the shown output match the current form?
  overLimit:     false,        // is the built output past the 32,000-char warning?
  pendingAction: null,         // the confirm-gated action, if any
  lastFocused:   null          // element to restore focus to after the dialog closes
}
```

The theme is **not** in `appState`: it is held in the DOM as
`html[data-bs-theme]` (Bootstrap 5.3's colour-mode attribute) and read back from
there when toggling.

Form values are **not** mirrored into JavaScript state — the DOM is the source of
truth for input, and `collectFormData()` reads it on demand. This avoids an
entire class of desynchronisation bugs at the cost of one DOM read per
validation/build, which is irrelevant at this size.

---

## 4. User journey — the happy path

```
 1. Open index.html
      └─ dark theme, Card A locked & included, 4,693-char instructions loaded

 2. Fill Card B (4 required + optionals)
      └─ typing clears that field's error; the full check runs on Generate

 3. Fill Card C (optional profile details)

 4. Card D — paste the resume, or:
      browse → file picker, or drop a file on the zone
        ├─ .txt  → FileReader.readAsText
        ├─ .pdf  → pdfjsLib  (needs a text layer)
        └─ .docx → mammoth
      └─ text lands in the textarea, editable; chip shows name + size
      └─ if the field already had text → confirm dialog first

 5. Optionally Cards E–H (opportunity, JD import, preferences, research, extra)

 6. Press "Generate Plugin Input"
      └─ validate → any error? focus first bad field, list errors, stop
      └─ build the selected mode → render read-only → pill "Generated"

 7. Review, then Copy, Download TXT, or Download JSON

 8. Later edits auto-refresh the output.
      └─ an edit that breaks a required field → pill "Out of date",
         downloads blocked, explicit reason shown
```

---

## 5. Data collection and validation

```
collectFormData()
      └─ reads every field into a plain object
         (trims text; keeps resumeText and jobDescription verbatim)

validateForm(data)
      └─ returns { errors: { fieldId: "message" }, firstInvalidId }

      Required (blocks generation):
        recipient.fullName · recipient.title · recipient.company
        recipient.email · resumeText

      Format (only if the field is non-empty):
        recipient.email         → email shape
        candidate.email         → email shape
        any *Url / *Url-ish     → plausible http(s) host; bare hosts accepted
                                  (ftp:// and similar are rejected)
```

```
handleGenerate()
      │
      ├─ validateForm()  ── errors ──▶ clearAllFieldErrors cleanup
      │                               showFieldError() per field
      │                                   └─ sets aria-invalid + shows .cr-error
      │                               renderValidationErrors() into the live strip
      │                               focus(firstInvalidId)
      │                               toast("Fix N field(s)…")
      │                               STOP — output untouched
      │
      └─ no errors ──▶ buildPluginInput(collectFormData(), outputMode)
                            │
                            ├─ { text, json, complete }
                            │
                       renderOutput()
                            ├─ textarea.textContent := the selected mode's text
                            ├─ char count, mode label
                            ├─ over-32,000-char warning (never truncates)
                            └─ pill "Generated", status "…does not send email…"
```

Errors are cleared per field as the user fixes them, so the UI self-heals rather
than accumulating stale red.

---

## 6. Building the payload

```
buildPluginInput(data, mode)
      │
      ├─ buildPlainText(data)
      │     9 numbered sections:
      │       1 Master Instructions
      │       2 Recipient and Company
      │       3 Candidate Profile
      │       4 Resume (full)
      │       5 Target Opportunity
      │       6 Outreach Preferences
      │       7 Research and Personalization
      │       8 Additional Context
      │       9 Required Output  → the 7 sections + the 100-point rubric
      │     absent optional → "[Not provided]"  (and stated as UNKNOWN)
      │
      ├─ buildJson(data)  ── JSON.stringify(payload, null, 2)
      │     product, generatedAt,
      │     masterInstructions { included, text },
      │     recipient, candidate { …resumeText }, opportunity, preferences,
      │     research { mode, … }, additionalContext, requestedOutputs[],
      │     disclosures { dataSource, researchPerformed:false, researchNote,
      │                   absenceNote, aiNote, privacyNote }
      │     absent optional → null
      │
      └─ mode switch:
            "text"     → text
            "json"     → json
            "complete" → text + "\n\n" + JSON banner + json
```

Both builders read the same collected object, so the brief and the JSON can never
disagree about a value.

**Master-instruction exclusion.** If the include-toggle is off, the text stays on
screen but `masterInstructions.text` becomes `null` in JSON and the section is
omitted from the brief, labelled as excluded by the user.

---

## 7. File import

```
   drop zone "drop"  ─┐
   drop zone dragover ┤
   browse button ─────┼──▶ handleFileUpload(file, target)
   hidden file input ─┘         │
                                ├─ 0 bytes        → error: empty file (stop)
                                ├─ > 10 MB        → error: size limit (stop)
                                ├─ unsupported    → error: name the type (stop)
                                ├─ target occupied → openConfirm(
                                │       "Replace existing text?",
                                │       warns if manually edited)
                                │            └─ confirmed ──▶ continue
                                └─ extractText*()
                                       ├─ extractTextFromTXT  (FileReader)
                                       ├─ extractTextFromPDF  (pdf.js per page)
                                       └─ extractTextFromDOCX (mammoth)

                       ┌────────────────────────────────────────┐
                       │ extractTextFromPDF: no text layer?      │
                       │   → "scanned/image-only; needs OCR or   │
                       │      a paste." Never imports junk.      │
                       │ library missing?                        │
                       │   → "PDF.js is not available … paste."  │
                       └────────────────────────────────────────┘

                       applyExtractionResult()
                            ├─ textarea.value := text   (editable, source of truth)
                            ├─ renderFileChip(name, size) with a remove control
                            ├─ status line: success + character count
                            └─ if generated → rebuild output (staleness rules)
```

The resume and job-description targets are entirely independent; importing into
one never reads or writes the other.

---

## 8. Actions

```
  Copy Output
      navigator.clipboard.writeText(text)
            ├─ ok   → toast "Copied N characters…"   (N measured, not assumed)
            └─ fail → legacy execCommand path
                        ├─ ok   → success toast
                        └─ fail → "Copy failed — the browser denied clipboard
                                   access…" (never claims success)

  Download TXT
      assertDownloadable()  → blocked? honest toast + stop
      build from appState.built (current form state)
      Blob → object URL → <a download> → click → URL.revokeObjectURL()

  Download JSON
      same gate, but the text is JSON.stringify(buildJson(collectFormData()))
      and is re-parsed before saving; the file is always valid JSON even if the
      Plain Text tab is on screen

  Clear Optional Inputs
      keep: 4 required recipient fields · resume text + imported file ·
            master instructions + lock/include state · current output
      clear: candidate · opportunity + job description · research ·
             additional context · recipient optionals
      reset: preferences to defaults, research mode to provided_information_only
      then: rebuild output so it no longer contains the cleared values

  Reset Entire Form
      openConfirm("Reset everything?")  ← nothing happens yet
            ├─ Cancel / Escape → no change at all
            └─ Confirm        → clear every field, drop imported files and chips,
                                clear the output → "Not generated",
                                restore DEFAULT_INSTRUCTIONS (locked + included),
                                restore preference defaults,
                                expand all cards, return mode to Complete Prompt
```

Every destructive action routes through the same modal:

```
  openConfirm(title, message, acceptLabel, action)
        │
        ├─ store appState.lastFocused and appState.pendingAction
        ├─ unhide backdrop, focus the accept button
        ├─ trap Tab / Shift+Tab between the two buttons
        ├─ Escape → closeConfirm(cancelled) → focus returns, action dropped
        └─ Confirm → run pendingAction → closeConfirm → restore focus
```

---

## 9. `app.js` section map

| # | Section | Responsibility |
|---|---------|----------------|
| 1 | Header comment | Purpose, privacy statement, structure notes |
| 2 | Config (`APP_CONFIG`) | `contextLimitChars: 32000`, `maxFileBytes: 10 MiB`, `downloadBaseName`, `themeStorageKey`, `pdfjsVersion`, author links |
| 3 | `DEFAULT_INSTRUCTIONS` | The 4,693-character master instruction text |
| 4 | State | `appState`, element cache `el`, `FIELD_IDS` |
| 5 | Utility helpers | `byId`, `val`, `orNull`, `hasText`, `fmtCount`, `formatFileSize`, `normalize`, `on` |
| 6 | Theme | `initializeTheme`, `applyTheme`, `toggleTheme` |
| 7 | Cards | `toggleCard`, `expandAllCards` |
| 8 | Instructions | `handleLockToggle`, `handleIncludeToggle`, `resetInstructionsToDefault`, `renderInstructions` |
| 9 | Counters | `updateCharacterCounts` |
| 10 | Custom fields | `updateCustomFieldVisibility` |
| 11 | Validation | `isValidEmail`, `isValidUrl`, `validateForm`, `showFieldError`, `clearFieldError`, `clearAllFieldErrors`, `renderValidationErrors` |
| 12 | Collection | `collectFormData` |
| 13 | Builders | `buildPluginInput`, `buildPlainText`, `buildJson` |
| 14 | Output rendering | `renderOutput`, `setOutputMode`, `setReadiness`, `setOutputStatusNotice`, `updateReadiness` |
| 15 | Actions | `handleGenerate`, `copyOutput`, `copyToClipboard`, `legacyCopy`, `downloadText`, `downloadJSON`, `triggerDownload`, `assertDownloadable`, `clearOptionalInputs`, `requestReset`, `resetForm`, `handleFormMutation` |
| 16 | File import | `handleFileUpload`, `detectKind`, `extractTextFromTXT`, `extractTextFromPDF`, `extractTextFromDOCX`, `applyExtractionResult`, `extractInto`, `renderFileChip`, `removeImportedFile`, `bindDropzone`, `submitFileInput`, `setTargetStatus` |
| 17 | Dialog | `openConfirm`, `closeConfirm`, `confirmPendingAction`, `cancelPendingAction`, `handleDialogKeydown` |
| 18 | Toasts & misc | `showToast`, `dismissToast` |
| 19 | Keyboard & bootstrap | `handleTabKeydown`, `init`, `DOMContentLoaded`, `window.ColdReach` test namespace |

---

## 10. Event map

| Control | Event | Handler |
|---------|-------|---------|
| `#themeToggle` | click | `toggleTheme` |
| `.cr-card-header` (×8) | click | `toggleCard` |
| `#instructionsLockBtn` | click | `handleLockToggle` |
| `#includeInstructions` | change | `handleIncludeToggle` |
| `#resetInstructionsBtn` | click | `resetInstructionsToDefault` |
| All text inputs/areas | input | `handleFormMutation` (clear that field's error, update counters, refresh output) |
| `#preferencesObjective` / `#preferencesTone` | change | `updateCustomFieldVisibility` + mutation |
| `#generateBtn` | click | `handleGenerate` |
| `#copyBtn` | click | `copyOutput` |
| `#downloadTxtBtn` / `#downloadJsonBtn` | click | `downloadText` / `downloadJSON` |
| `#clearOptionalBtn` | click | `clearOptionalInputs` |
| `#resetFormBtn` | click | `requestReset` |
| `#resumeFile` / `#jobDescFile` | change | `handleFileUpload` |
| Drop zones (×2) | dragover / dragleave / drop | `bindDropzone` |
| Browse buttons (×2) | click | `submitFileInput` |
| Remove-file buttons (×2) | click | confirm → `removeImportedFile` |
| Mode tabs (×3) | click / keydown | `setOutputMode` / `handleTabKeydown` |
| Dialog buttons + backdrop | click / keydown | confirm/cancel/`handleDialogKeydown` |
| Toast dismiss buttons | click | `dismissToast` |

Zero entries in this table are implemented with an inline attribute in the HTML.

---

## 11. Theming and layout flow

```
  initializeTheme()            (on load)
      ├─ read localStorage["coldreach.theme"]  (try/catch; absent → "dark")
      └─ applyTheme(theme, persist=false)      ← no write on first load

  toggleTheme()                (user action)
      ├─ read current value from html[data-bs-theme], flip it
      └─ applyTheme(next, persist=true)
             ├─ html[data-bs-theme] = next
             ├─ aria-pressed, title, button label, sun/moon glyph
             └─ localStorage["coldreach.theme"] = next  (try/catch; failure ignored)

  Layout
      ≥ 992 px   body = 100vh flex column, overflow hidden
                 header / validation / toolbar / footer = fixed rows
                 .cr-workspace = remaining height
                     ├─ .cr-inputs  → flex column, height 100%, overflow-y auto
                     └─ .cr-output  → flex column, height 100%
                                       └─ textarea flex:1, resize:none, scrolls
                 ⇒ page never scrolls; columns scroll; toolbar cannot overlap
      < 992 px   normal document flow, single column, page scrolls,
                 toolbar static at the end of the content (covers nothing),
                 textarea min-height 300px / max-height 60vh
```

---

## 12. Privacy flow (the short version)

```
  user input ──▶ DOM ──▶ collectFormData() ──▶ builders ──▶ textarea / Blob
                   │
                   ├─ ✗ no fetch/XHR/beacon      (memory only)
                   ├─ ✗ no localStorage except theme
                   ├─ ✗ no URL parameters
                   ├─ ✗ no analytics
                   └─ ✗ nothing written to the console

  Reload / close the tab  ⇒  every piece of personal data is gone.
```
