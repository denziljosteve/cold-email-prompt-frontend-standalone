================================================================================
ColdReach Career Coach
Personalized Outreach & Resume Intelligence
A standalone, frontend-only prompt builder
================================================================================

WHAT THIS IS
------------
ColdReach Career Coach helps a job seeker assemble one complete, well-structured
input package for a downstream AI career-coaching tool: recipient and company
details, candidate profile, full resume text, target opportunity, outreach
preferences, research notes, and additional context.

The application builds the INPUT. It is not the coach itself.

WHAT THIS IS NOT (READ THIS FIRST)
----------------------------------
This application does NOT:
  * generate emails or career advice (no AI model is called),
  * research people, companies, or job postings (no live research integration),
  * send email or contact anyone,
  * submit job applications,
  * upload your resume or any document to a server,
  * predict hiring outcomes.

It never fabricates candidate achievements, qualifications, recipient details,
job openings, company research, or deployment status, and neither does the
instruction set it hands to the downstream coach.


================================================================================
1. HOW TO RUN IT
================================================================================
1. Keep these four files together in one folder:
      index.html
      styles.css
      app.js
      README.txt
2. Double-click index.html (or right-click > Open with > your browser).
3. That is it. There is no build step, no installer, no terminal command, and no
   local web server required.

Supported: current Chrome, Edge, Firefox, and Safari on desktop. Also usable on
tablet and mobile browsers.

NOTE ON INTERNET ACCESS: the page loads its styling, icons, font, and the two
document-extraction libraries from public CDNs (see section 7). Those loads are
ordinary requests to those providers and they require an internet connection.
Without a connection the application still opens and all paste-and-generate
features work; only PDF/DOCX import is unavailable. This is therefore NOT a
fully offline application.


================================================================================
2. THE EIGHT INPUT CARDS
================================================================================
A. Master Instructions
   The complete instruction set sent to the downstream coach, stored in the
   JavaScript constant DEFAULT_INSTRUCTIONS. It is LOCKED (read-only) and
   INCLUDED in the output on first load.
     * "Locked" toggle  - unlock to edit freely; locking again never deletes text.
     * "Include in output" toggle - excluding removes the instructions from the
       generated payload while keeping your text on screen.
     * "Reset to default" - restores the original text and re-locks it.
     * Live character counter.

B. Recipient & Company  (4 required fields)
   Required: contact full name, current position/title, company name, contact
   email address.
   Optional: LinkedIn URL, company website URL, team/department, background notes.
   The email format and every supplied URL are checked when you generate; once an
   error is shown, it clears as soon as you correct that field. A URL only needs
   to be plausible: "https://example.com/page", "example.com/page" and
   "www.example.com" are all accepted. No network request is made to check any
   URL.

C. Candidate Profile  (all optional)
   Name, email, phone, LinkedIn, portfolio, GitHub, location or target job
   market, target role/title, additional achievements or context.
   Missing information is never guessed or invented downstream.

D. Resume  (required)
   Paste text, or import .pdf / .docx / .txt by browsing or by drag & drop.
     * Extracted text is fully editable in the textarea - that text is what gets
       sent, so you can correct extraction artefacts before generating.
     * The file name and size are shown, and the file can be removed.
     * If the field already contains text (typed or imported), importing another
       file asks for confirmation first, and warns you if you have manually
       edited the existing text. Nothing is discarded without confirmation.
     * 10 MB maximum file size. Accepted extensions: .pdf, .docx, .txt.
     * PDF import needs a text layer. Image-only/scanned PDFs cannot be read and
       the app says so explicitly instead of importing junk. Run OCR first, or
       copy the text in manually.
     * Content is NEVER silently truncated.

E. Target Opportunity  (optional)
   Target role, job posting URL, required skills/qualifications, industry/domain,
   experience level, additional hiring context, and a job description that can be
   pasted or imported from .pdf/.docx/.txt.
   Resume and job-description imports are completely independent fields; importing
   into one never touches the other.
   If the job description is left empty, the master instructions tell the coach to
   produce a clearly labelled HEURISTIC assessment from the target title alone and
   to state that it does not know the real hiring criteria.

F. Outreach Preferences
   Objective (8 options incl. custom), tone (5 options incl. custom), email
   length (Short 60-100 / Standard 100-170 / Detailed 170-250 words), preferred
   language, preferred sign-off, achievements to emphasise, desired call to
   action, phrases to avoid, plus three switches: include networking
   alternative, include referral alternative, include shorter version.
   Selecting "Custom objective" or "Custom tone" reveals a text box.
   Sensible defaults are pre-selected and survive until you change or reset them.

G. Research & Personalization
   Research mode, recipient profile URL, company website, known company projects
   or initiatives, recent developments you supply, existing relationship or shared
   context, and research notes.
   IMPORTANT: "Research-enabled mode" is present in the selector but DISABLED and
   marked unavailable, because this build has no live research integration.
   "User-supplied information only" is the only selectable mode and the default.
   The instructions forbid the coach from claiming that any profile, website or
   posting was visited or verified.

H. Additional Context  (all optional)
   Previous email or correspondence, why you want to contact the company, your
   strongest selling point, specific resume concerns, and additional instructions.
   No optional field ever blocks generation.


================================================================================
3. GENERATING, COPYING AND DOWNLOADING
================================================================================
The right-hand panel is titled "Generated Plugin Input".

Three output formats (tabs):
  1. Complete Prompt  - the plain-text brief PLUS the structured JSON payload.
                        The maximal "everything" package.
  2. Structured JSON  - the JSON payload on its own (machine-readable).
  3. Plain Text       - the human-readable brief on its own (no JSON).

The output box is read-only, shows a live character count, and the panel shows the
current format, a status line, and a Generated / Ready / Out-of-date indicator.

Press "Generate Plugin Input" (bottom toolbar) once the four required recipient
fields and the resume text are present. Invalid input is reported inline next to
the offending field, highlighted in red, listed in a summary strip, and the first
problem field is focused. Required fields that block generation are only:
contact full name, title, company, email, and resume content.

Staying honest about freshness:
  * After generating, editing the form rebuilds the output from your current values,
    and the status line says it was refreshed automatically.
  * If an edit removes a required value, the previous output stays visible but the
    panel is marked "Out of date" and downloads are blocked until you regenerate.
    Stale output is never presented as current.

Toolbar actions:
  * Generate Plugin Input - validate, assemble, and display the selected format.
  * Copy Output           - copies the visible output. Uses the Clipboard API and
                            falls back to a legacy copy path. If the browser
                            refuses clipboard access it says so; it never reports a
                            false success.
  * Download TXT          - saves ColdReach_Plugin_Input.txt
  * Download JSON         - saves ColdReach_Plugin_Input.json, always valid JSON,
                            built from the CURRENT form state no matter which tab
                            is selected, and re-parsed internally before saving.
                            A plain-text prompt is never saved with a .json name.
  * Clear Optional Inputs - clears candidate profile, target opportunity and job
                            description, preferences (back to defaults), research
                            notes, and additional context. It KEEPS the four
                            required recipient fields, the resume text and its
                            imported file, and the master instructions with their
                            lock/include state.
  * Reset Entire Form     - asks for confirmation, then clears all personal data,
                            removes imported files, clears the output, restores
                            defaults, and re-locks the master instructions.
                            Cancelling changes nothing.

The generated panel also warns (without truncating anything) when the complete
package exceeds 32,000 characters, which is a common downstream context limit.


================================================================================
4. THE OUTPUT FORMAT
================================================================================
The plain-text brief is organised into nine numbered sections:
  1. Master Instructions       6. Outreach Preferences
  2. Recipient and Company     7. Research and Personalization
  3. Candidate Profile         8. Additional Context
  4. Resume (full, unedited)   9. Required Output
  5. Target Opportunity

Absent optional values are printed as "[Not provided]" and are explicitly
described as UNKNOWN, not as verified-absent. A provenance header states that
every value came from you, that no web research and no AI analysis was performed
by this tool, and that URL fields are references you typed rather than pages it
read.

Section 9 instructs the downstream coach to return these seven sections, in order:
  1. Outreach Strategy
  2. Subject Lines
  3. Primary Cold Email
  4. Alternative Email
  5. Resume Fit Assessment
  6. Resume Improvements
  7. Recommended Next Steps

Resume fit uses a 100-point heuristic rubric:
  Relevant experience and responsibilities .... 30
  Skills and tools explicitly evidenced ....... 25
  Achievements and measurable impact .......... 20
  Industry/domain alignment ................... 15
  Relevant education and certifications ....... 10
The coach must explain each score, cite resume evidence, distinguish missing
evidence from a demonstrated lack of ability, label assumptions, and state that
the score is a heuristic and not a prediction of hiring success.

Structured JSON mirrors the same content. Property names are stable and
documented; missing optional values are null (never "..." or other placeholder
text), and the resume and job description are preserved in full.
Top level: product, generatedAt, masterInstructions, recipient, candidate,
opportunity, preferences, research, additionalContext, requestedOutputs,
disclosures.
Notes:
  * masterInstructions.text is null when the instructions are excluded.
  * preferences.customObjective / customTone are only populated when the matching
    option is "custom"; otherwise they are null.
  * requestedOutputs always lists the seven section identifiers.
  * disclosures is an explanatory block: it records that all values are
    user-supplied, that no research was performed, that null means unknown
    rather than absent, that this tool produced no advice itself, and that no
    data left the device.
  * resumeText lives under "candidate"; the job description lives under
    "opportunity". These names follow the documented baseline schema.


================================================================================
5. KEYBOARD, THEME AND ACCESSIBILITY
================================================================================
  * Every control is keyboard reachable and operable; there are no inline
    JavaScript event handlers anywhere in the markup.
  * Card headers are real buttons that collapse/expand with aria-expanded.
  * The output format tabs implement the tablist pattern: Arrow Left/Right wrap
    around, Home and End jump to the first/last tab.
  * The confirmation dialog is a real modal (role="dialog", aria-modal="true"),
    moves focus to the confirm button, traps Tab between its two buttons, closes
    on Escape, supports Shift+Tab, and returns focus when it closes.
  * A "Skip to main content" link is the first focusable element.
  * Errors are linked to their fields with aria-invalid and aria-describedby, and
    status messages use live regions.
  * Dark theme is the default; the theme button in the header switches to light
    and back. Colours and contrast were audited with Lighthouse (see section 9).
  * "Reduce motion" system preferences are respected.
  * Layout: two columns on desktop (about 60% inputs / 40% output) with each
    column scrolling independently inside a fixed application shell, so the
    header, action toolbar and footer are always visible and the toolbar never
    covers the form or the output. Below 992px it becomes a single flowing column
    with full-width controls and a two-up action area at the end of the content.


================================================================================
6. PRIVACY AND SECURITY
================================================================================
  * No server, no backend, no database, no account, no analytics, no telemetry.
  * Your form data, resume text, job description and documents stay in this
    browser tab's memory for the lifetime of the page.
  * Nothing is written to localStorage or sessionStorage EXCEPT the theme choice
    (key: "coldreach.theme"). Reloading the page discards all personal data - this
    was verified by entering data and reloading.
  * Personal data is never placed in URL parameters.
  * Document text is never written to the browser console.
  * No AI API is called, and no form data is transmitted anywhere by the app.
  * User-controlled text is inserted with textContent; the app never builds HTML
    from your input. There is no eval(), no new Function(), and no document.write().
  * Temporary object URLs used for downloads are revoked after use.
  * Resetting the form clears the data, and the "Clear Optional Inputs" action
    removes everything that is not required.
  * The only outbound requests the page makes are the CDN and font loads listed in
    section 7. No request carries your data.

Residual considerations:
  * CDN scripts execute with full page privileges. If a CDN were compromised, the
    injected code would run in this page. Pin exact versions (as this build does)
    and, for higher assurance, host the libraries locally or serve the page over
    HTTPS with a Content-Security-Policy (see PRODUCTIONDEPLOY.md).
  * Because the app loads remote code, it is not verifiable as "offline-only".


================================================================================
7. THIRD-PARTY DEPENDENCIES (PINNED)
================================================================================
  Bootstrap 5.3.3            CSS + JS bundle      cdn.jsdelivr.net
  Bootstrap Icons 1.11.3     CSS                  cdn.jsdelivr.net
  Google Fonts "Inter"       CSS + font files     fonts.googleapis.com / fonts.gstatic.com
  PDF.js 3.4.120             pdf.min.js, and the matching pdf.worker.min.js
                             (same version)       cdnjs.cloudflare.com
  Mammoth.js 1.6.0           mammoth.browser.min.js  cdnjs.cloudflare.com

The PDF.js worker URL is set in app.js from APP_CONFIG.pdfjsVersion, which is kept
in sync with the script tag in index.html. Changing one without the other is the
most common way to break PDF import; keep them equal.

Bootstrap's JavaScript bundle is included for completeness but the application
does not depend on any Bootstrap JS component - all interactions are implemented
directly, so a failed Bootstrap JS load does not break the app.


================================================================================
8. TROUBLESHOOTING AND KNOWN LIMITATIONS
================================================================================
The page opens but looks unstyled / icons missing
  You are offline or a CDN is blocked. Styling, icons and the Inter font come from
  the network. Functionality is otherwise unaffected.

"PDF.js is not available" or "Mammoth.js is not available" when importing
  The library script did not load (offline, blocked, or corporate proxy). Paste
  your document text into the textarea instead; everything else still works.

PDF imports nothing, or says no selectable text was found
  The PDF has no text layer - it is a scan or an image export. Import requires
  real text. Run OCR (or copy the text) first. This is a deliberate limitation:
  OCR is out of scope, and silently importing nothing would be worse.

Opening index.html directly from disk (file:// address)
  * Everything works from disk, including PDF import, because PDF.js falls back to
    running its parser on the main thread when a cross-origin worker cannot be
    started from a file:// page. If a browser does block it, the app reports that
    the PDF could not be read and asks you to paste the text instead.
  * Some browsers restrict clipboard access on file:// pages. If Copy reports a
    failure, select the output text and press Ctrl+C (Cmd+C on macOS).
  * Downloads work as normal; your browser may ask where to save the files.
  * If your browser is unusually restrictive about local files, serve the folder
    over HTTPS instead - see PRODUCTIONDEPLOY.md. This is optional, never required.

The document text is repeated in the "Complete Prompt" output twice
  By design: that format contains both the plain-text brief and the JSON payload.
  Use the "Plain Text" or "Structured JSON" tab if you only want one of them.

The output is very long
  Large resumes produce large payloads. Nothing is truncated. Generate with the
  "Structured JSON" tab and download that, or trim the resume text, if your
  downstream tool has a context limit. A warning appears past 32,000 characters.

"Research-enabled mode" cannot be selected
  Correct and intentional. There is no live research integration in this build, so
  the option is disabled rather than faked.

Pasting a DOCX-as-text or copying from a PDF gives odd spacing
  Extracted text is editable on purpose. Fix it in the textarea before generating;
  the textarea content is what gets sent.

Mobile keyboard covers a field
  Scroll the field into view; layout is a single flowing column below 992px.


================================================================================
9. VERIFICATION SUMMARY
================================================================================
Everything below was actually executed in a Chromium browser against this build,
served locally over HTTP (the browser automation available for this project cannot
open file:// addresses - see PROGRESS.md).

Confirmed working:
  * Page loads with zero console messages; all 8 cards, 6 toolbar buttons, 0 inline
    event handlers; Bootstrap, Bootstrap Icons, Inter, PDF.js and Mammoth all load.
  * Dark/light theme switching applies the correct colours and persists only the
    theme key; all personal data is gone after a reload.
  * Master instructions start locked and included; unlock/edit/relock keeps the
    text; reset-to-default restores 4,693 characters and re-locks; excluding removes
    them from the payload while keeping the text on screen.
  * Character counters for instructions, resume, job description and output.
  * Required-field and email/URL validation, inline errors, focus on the first
    invalid field, and a validation summary; invalid submissions produce no output.
  * Generation in all three formats; JSON parses and contains every field, the
    exact resume and job-description text, null for omitted optionals, and the seven
    requested outputs.
  * Staleness handling: edits refresh the output; breaking a required field marks
    the output out of date and blocks downloads.
  * Copy (success and a forced-failure path that reports failure honestly).
  * Downloads captured by the browser: ColdReach_Plugin_Input.txt and
    ColdReach_Plugin_Input.json (valid JSON re-read from disk).
  * Clear Optional Inputs preserves the required fields, resume and instructions
    while clearing everything else and resetting preferences.
  * Reset requires confirmation, cancelling changes nothing, and confirming clears
    everything and restores defaults.
  * TXT, DOCX and PDF imports (via the file picker and via drag & drop), plus
    independent resume/job-description targets, with the replacement confirmation
    dialog shown before existing edited text is replaced.
  * Rejections with content preserved: 0-byte file, unsupported .csv, over-10MB
    file, image-only PDF (OCR explanation), corrupt DOCX.
  * Graceful messages when PDF.js or Mammoth is unavailable, with paste still working.
  * No app-level network requests carrying data; no localStorage/sessionStorage
    personal data.
  * Desktop app shell: no page scrollbar, columns scroll internally, toolbar and
    footer always visible and never overlapping the form or output.
  * Mobile (390px) single-column layout with no horizontal overflow.
  * Lighthouse on the final build: Accessibility 1.00, Best Practices 1.00,
    SEO 1.00, zero failing audits.

Not verified by automation (documented in PROGRESS.md as outstanding):
  * Opening the file by double-clicking (file://) - the available automation only
    accepts http/https URLs, so the disk-opened path relies on manual testing. The
    application was verified over HTTP only.
  * Hardware-level keyboard walkthrough - key injection from the automation driver
    was unreliable in this environment, so keyboard behaviour was verified by
    dispatching genuine keydown events to the focused controls. A manual keyboard
    pass in a real browser is still recommended.
  * A real >10 MB file transfer - the automation harness caps transfers at 5 MiB,
    so the 10 MB limit was exercised with an in-browser synthetic file drop.
  * Screenshots were not captured (the screenshot tool required a visible desktop
    window that was not available).


================================================================================
10. AUTHOR
================================================================================
Built by Denzil Josteve Fernandes

  Portfolio : https://denziljosteve.github.io/
  LinkedIn  : https://www.linkedin.com/in/denziljosteve/
  GitHub    : https://github.com/denziljosteve/

Attribution for the footer is kept in one place: the APP_CONFIG.author object in
app.js, and the matching links in the index.html footer.

================================================================================
