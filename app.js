/* ==========================================================================
   ColdReach Career Coach — app.js
   --------------------------------------------------------------------------
   A frontend-only prompt builder. It assembles a structured plugin input
   from user-entered career data. It does NOT call an AI API, perform web
   research, send email, submit applications, or upload documents anywhere.

   Privacy: personal data and document contents live in page memory only.
   The single exception is the theme choice, stored under
   localStorage["coldreach.theme"]. See README.txt and flow.md.

   Architecture: one IIFE, no globals leaked to `window` except nothing.
   Dependencies are read from the pinned CDN globals `pdfjsLib` (PDF.js
   3.4.120) and `mammoth` (1.6.0), both loaded in index.html.
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     1. CONFIGURATION
     ====================================================================== */

  /** Safe-to-edit application constants. Contains no user data. */
  var APP_CONFIG = {
    productName: "ColdReach Career Coach",
    tagline: "Personalized Outreach & Resume Intelligence",
    author: {
      name: "Denzil Josteve Fernandes",
      portfolio: "https://denziljosteve.github.io/",
      linkedin: "https://www.linkedin.com/in/denziljosteve/",
      github: "https://github.com/denziljosteve/"
    },
    /** Soft size warning threshold for the assembled payload, in characters. */
    contextLimitChars: 32000,
    /** Maximum accepted upload size (bytes). */
    maxFileBytes: 10 * 1024 * 1024,
    /** Base name for both downloads. */
    downloadBaseName: "ColdReach_Plugin_Input",
    /** The only persisted value in the whole application. */
    themeStorageKey: "coldreach.theme",
    /** Cached-in-browser library versions (kept in sync with index.html). */
    pdfjsVersion: "3.4.120",
    mammothVersion: "1.6.0"
  };

  /**
   * Default master instruction set. Locked and included on first load.
   * Enforces factual accuracy, evidence-based resume analysis, privacy,
   * honest research disclosure, and strict avoidance of fabrication.
   */
  var DEFAULT_INSTRUCTIONS = [
    "ROLE",
    "You are ColdReach Career Coach: an expert career strategist, professional cold-email writer, networking advisor, and ATS resume reviewer. You prepare drafts and analysis only. You never send email, submit applications, or contact anyone on the user's behalf.",
    "",
    "NON-NEGOTIABLE RULES",
    "1. FACTUAL ACCURACY. Use only facts present in the inputs supplied below (resume, job description, user research notes, user context). Never invent employers, job titles, dates, metrics, technologies, certifications, relationships, job openings, or recipient details.",
    "2. EVIDENCE-BASED ANALYSIS. Every resume claim, score, and recommendation must trace to specific supplied evidence. Cite or quote that evidence. If evidence is missing, say it is missing.",
    "3. MISSING IS NOT ABSENT. A skill that does not appear in the resume is 'not evidenced in the supplied resume'. It is not proof the candidate lacks it. Only describe a skill as lacking when the user explicitly states so.",
    "4. LABEL UNCERTAINTY. Separate (a) facts supplied by the user, (b) reasonable inferences, and (c) unknowns. Label every inference as an inference and state its basis. Never present an inference as a confirmed fact.",
    "5. PRIVACY. Do not infer, speculate about, or reference sensitive personal traits (age, gender, ethnicity, religion, health, family status, nationality, disability, and similar). Do not reproduce candidate contact details in the email bodies unless they are needed in a signature block and the user has supplied them.",
    "6. HONEST RESEARCH DISCLOSURE. No live web research was performed and no recipient profile or company website was visited. Personalization may only use information the user typed in. Do not claim to have visited a page, read a profile, or verified a company fact. If personalization material is insufficient, say so plainly.",
    "7. NO FABRICATED PERSONALIZATION OR FLATTERY. Do not invent shared connections, mutual interests, compliments about the recipient's work, or claims about the company's priorities.",
    "8. RESPECT THE USER'S INPUT. Preserve the meaning of supplied information. Do not upgrade, inflate, or embellish achievements. Do not silently drop any supplied content.",
    "",
    "RESUME FIT SCORING RUBRIC (100-point heuristic; only when a job description or target title is available)",
    "- Relevant experience and responsibilities: 30 points",
    "- Skills and tools explicitly evidenced in the resume: 25 points",
    "- Achievements and measurable impact: 20 points",
    "- Industry or domain alignment: 15 points",
    "- Relevant education and certifications: 10 points",
    "For every category: state the score, explain the rationale, cite the supporting resume evidence, and note what evidence is missing. Report a total out of 100. State clearly that this score is a heuristic for prioritising effort and is NOT a prediction of hiring success. If no job description is supplied, run a clearly labelled heuristic assessment against the target title only, and never claim to know the actual hiring criteria.",
    "",
    "REQUIRED OUTPUT SECTIONS (return them in this order, using these headings)",
    "1. Outreach Strategy - the approach for this specific recipient, personalization opportunities that are genuinely supported by the supplied information, the outreach objective, and the rationale for the angle.",
    "2. Subject Lines - two or three options, plus one recommended subject line with a one-line reason.",
    "3. Primary Cold Email - the email tailored to the selected objective, tone, and length, including recipient name, subject, body, a single clear call to action, sign-off, and a signature block if the user supplied contact details.",
    "4. Alternative Email - a genuinely different approach, honouring the enabled networking, referral, and shorter-version preferences.",
    "5. Resume Fit Assessment - evidence-based analysis with the weighted rubric, cited evidence, and stated uncertainty.",
    "6. Resume Improvements - specific, actionable changes that are supported by the supplied resume and opportunity information, including a rewritten professional summary, prioritised edits, original-versus-revised bullet examples, and ATS or keyword alignment notes.",
    "7. Recommended Next Steps - realistic, prioritised actions for the candidate.",
    "If the user asks for one specific section only, do not force the others.",
    "",
    "PERSONALIZATION LIMITATIONS TO STATE OUT LOUD",
    "If the recipient's profile, company initiatives, recent developments, or the job requirements were not supplied, list the resulting personalization limitations before drafting, and keep the draft honest within those limits.",
    "",
    "TONE AND LENGTH",
    "Match the requested tone and the requested email length range. Keep outreach specific, respectful of the recipient's time, and free of unsupported praise."
  ].join("\n");

  /* ======================================================================
     2. STATE
     ====================================================================== */

  /**
   * Mutable application state. `null` is used for "not provided" so that the
   * generated payload never contains placeholder text.
   *
   * Note: document text, filenames and all other personal data deliberately
   * live here (and in the DOM) for the lifetime of the page only.
   */
  var appState = {
    instructions: { locked: true, included: true },
    resume: { extractedText: "", fileName: null, fileSize: null },
    jobDescription: { extractedText: "", fileName: null, fileSize: null },
    outputMode: "complete",
    built: null,
    hasGenerated: false,
    outputIsCurrent: false,
    overLimit: false,
    pendingAction: null,
    lastFocused: null,
    // The red "missing inputs" strip is deliberately quiet until the user
    // actually presses Generate; the progress card already lists what is
    // outstanding without alarming anyone on first load.
    validationRequested: false
  };

  /** Cached DOM references, populated by cacheElements(). */
  var el = {};

  /** Field metadata for validation: input id -> error element id. */
  var FIELD_IDS = {
    recipientFullName: "err-recipientFullName",
    recipientTitle: "err-recipientTitle",
    recipientCompany: "err-recipientCompany",
    recipientEmail: "err-recipientEmail",
    recipientLinkedin: "err-recipientLinkedin",
    recipientCompanyWebsite: "err-recipientCompanyWebsite",
    resumeText: "err-resumeText",
    candidateEmail: "err-candidateEmail",
    candidateLinkedin: "err-candidateLinkedin",
    candidatePortfolio: "err-candidatePortfolio",
    candidateGithub: "err-candidateGithub",
    opportunityJobUrl: "err-opportunityJobUrl",
    researchRecipientProfile: "err-researchRecipientProfile",
    researchCompanyWebsite: "err-researchCompanyWebsite"
  };

  /* ======================================================================
     3. SMALL HELPERS
     ====================================================================== */

  /** Collapse CRLF and runs of blank lines, then trim. Never truncates. */
  function normalize(value) {
    return String(value == null ? "" : value)
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /** True when a value has real content. */
  function hasText(value) {
    return normalize(value).length > 0;
  }

  /** Optional-value helper used by the JSON builder: "" -> null. */
  function orNull(value) {
    var v = normalize(value);
    return v.length ? v : null;
  }

  /** "Label: value" line for the plain-text brief; absent values are marked. */
  function line(label, value) {
    return label + ": " + (hasText(value) ? normalize(value) : "[Not provided]");
  }

  function fmtCount(chars) {
    return Number(chars).toLocaleString("en-US") + " characters";
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  }

  /**
   * Plausible-URL check. Purely syntactic: no network request is made.
   * Accepts "https://x.com", "x.com/path", "www.x.com".
   */
  function isValidUrl(value) {
    var v = String(value == null ? "" : value).trim();
    if (!v) return true;
    if (/\s/.test(v)) return false;
    try {
      var withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : "https://" + v;
      var url = new URL(withProto);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      return /^[^\s.]+(\.[^\s.]+)+$/.test(url.hostname);
    } catch (err) {
      return false;
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  /* ======================================================================
     4. INITIALISATION
     ====================================================================== */

  function cacheElements() {
    el = {
      // Header
      themeToggle: byId("themeToggle"),
      themeIcon: byId("themeIcon"),
      themeToggleLabel: byId("themeToggleLabel"),
      headerResetBtn: byId("headerResetBtn"),

      // Required-field progress
      progress: byId("requiredProgress"),
      progressBar: byId("progressBar"),
      progressFill: byId("progressFill"),
      progressCount: byId("progressCount"),
      progressHint: byId("progressHint"),
      cardStateB: byId("cardStateB"),
      cardStateBText: byId("cardStateBText"),
      cardStateD: byId("cardStateD"),
      cardStateDText: byId("cardStateDText"),

      // Card A
      instructionsText: byId("instructionsText"),
      instructionsCount: byId("instructionsCount"),
      lockToggle: byId("lockToggle"),
      includeInstructions: byId("includeInstructions"),
      lockStatusText: byId("lockStatusText"),
      resetInstructionsBtn: byId("resetInstructionsBtn"),

      // Card D
      resumeDropzone: byId("resumeDropzone"),
      resumeFile: byId("resumeFile"),
      resumeBrowseBtn: byId("resumeBrowseBtn"),
      resumeFileRow: byId("resumeFileRow"),
      resumeFileName: byId("resumeFileName"),
      resumeFileSize: byId("resumeFileSize"),
      resumeRemoveBtn: byId("resumeRemoveBtn"),
      resumeStatus: byId("resumeStatus"),
      resumeText: byId("resumeText"),
      resumeCount: byId("resumeCount"),

      // Card E
      jobDescDropzone: byId("jobDescDropzone"),
      jobDescFile: byId("jobDescFile"),
      jobDescBrowseBtn: byId("jobDescBrowseBtn"),
      jobDescFileRow: byId("jobDescFileRow"),
      jobDescFileName: byId("jobDescFileName"),
      jobDescFileSize: byId("jobDescFileSize"),
      jobDescRemoveBtn: byId("jobDescRemoveBtn"),
      jobDescStatus: byId("jobDescStatus"),
      opportunityJobDescription: byId("opportunityJobDescription"),
      opportunityCount: byId("opportunityCount"),

      // Card F
      preferencesObjective: byId("preferencesObjective"),
      preferencesObjectiveCustomField: null,
      preferencesObjectiveCustom: byId("preferencesObjectiveCustom"),
      preferencesTone: byId("preferencesTone"),
      preferencesToneCustomField: null,
      preferencesToneCustom: byId("preferencesToneCustom"),
      preferencesLength: byId("preferencesLength"),

      // Output panel
      outputPanel: byId("outputPanel"),
      outputReadiness: byId("outputReadiness"),
      outputReadinessIcon: byId("outputReadinessIcon"),
      outputReadinessText: byId("outputReadinessText"),
      outputStatusText: byId("outputStatusText"),
      outputText: byId("outputText"),
      outputEmpty: byId("outputEmpty"),
      outputWarn: byId("outputWarn"),
      outputModeLabel: byId("outputModeLabel"),
      outputCount: byId("outputCount"),
      tabs: Array.prototype.slice.call(document.querySelectorAll(".cr-tab")),

      // Toolbar
      generateBtn: byId("generateBtn"),
      copyBtn: byId("copyBtn"),
      downloadTxtBtn: byId("downloadTxtBtn"),
      downloadJsonBtn: byId("downloadJsonBtn"),
      clearOptionalBtn: byId("clearOptionalBtn"),
      resetFormBtn: byId("resetFormBtn"),

      // Structural
      form: byId("crForm"),
      validationSummary: byId("validationSummary"),
      validationSummaryText: byId("validationSummaryText"),
      toastRegion: byId("toastRegion"),
      confirmBackdrop: byId("confirmBackdrop"),
      confirmTitle: byId("confirmTitle"),
      confirmBody: byId("confirmBody"),
      confirmOkBtn: byId("confirmOkBtn"),
      confirmCancelBtn: byId("confirmCancelBtn")
    };
    el.preferencesObjectiveCustomField = el.preferencesObjectiveCustom.closest(".cr-field");
    el.preferencesToneCustomField = el.preferencesToneCustom.closest(".cr-field");
  }

  /** Batch-register listeners so no inline handlers exist in the markup. */
  function on(target, type, handler, options) {
    if (target) target.addEventListener(type, handler, options);
  }

  function initializeApp() {
    cacheElements();
    initializeTheme();
    initializeDependencies();

    // Card A — master instructions
    el.instructionsText.value = DEFAULT_INSTRUCTIONS;
    el.instructionsText.readOnly = true;
    on(el.lockToggle, "change", handleLockToggle);
    on(el.includeInstructions, "change", handleIncludeToggle);
    on(el.resetInstructionsBtn, "click", resetInstructionsToDefault);
    on(el.instructionsText, "input", function () {
      updateCharacterCounts();
      handleFormMutation();
    });

    // Card D / E — imports
    bindDropzone(el.resumeDropzone, el.resumeFile, "resume");
    bindDropzone(el.jobDescDropzone, el.jobDescFile, "jobDescription");
    on(el.resumeFile, "change", function () {
      submitFileInput(el.resumeFile, "resume");
    });
    on(el.jobDescFile, "change", function () {
      submitFileInput(el.jobDescFile, "jobDescription");
    });
    on(el.resumeRemoveBtn, "click", function () {
      removeImportedFile("resume");
    });
    on(el.jobDescRemoveBtn, "click", function () {
      removeImportedFile("jobDescription");
    });
    on(el.resumeText, "input", function () {
      updateCharacterCounts();
      handleFormMutation();
    });
    on(el.opportunityJobDescription, "input", function () {
      updateCharacterCounts();
      handleFormMutation();
    });

    // Card F — conditional custom fields
    on(el.preferencesObjective, "change", function () {
      updateCustomFieldVisibility();
      handleFormMutation();
    });
    on(el.preferencesTone, "change", function () {
      updateCustomFieldVisibility();
      handleFormMutation();
    });

    // Anything else in the form that changes
    on(el.form, "input", function (event) {
      if (event.target === el.instructionsText || event.target === el.resumeText ||
          event.target === el.opportunityJobDescription) {
        return; // already handled above
      }
      clearFieldError(event.target.id);
      updateCharacterCounts();
      handleFormMutation();
    });
    on(el.form, "change", function (event) {
      if (event.target === el.preferencesObjective || event.target === el.preferencesTone) return;
      clearFieldError(event.target.id);
      handleFormMutation();
    });

    // Output panel
    el.tabs.forEach(function (tab) {
      on(tab, "click", function () {
        setOutputMode(tab.getAttribute("data-mode"));
      });
      on(tab, "keydown", handleTabKeydown);
    });

    // Toolbar
    on(el.generateBtn, "click", handleGenerate);
    on(el.copyBtn, "click", copyOutput);
    on(el.downloadTxtBtn, "click", downloadText);
    on(el.downloadJsonBtn, "click", downloadJSON);
    on(el.clearOptionalBtn, "click", clearOptionalInputs);
    on(el.resetFormBtn, "click", requestReset);
    on(el.headerResetBtn, "click", requestReset);
    on(el.themeToggle, "click", toggleTheme);

    // Collapsible cards
    Array.prototype.slice.call(document.querySelectorAll("[data-collapse]")).forEach(function (btn) {
      on(btn, "click", function () {
        toggleCard(btn);
      });
    });

    // Confirmation dialog
    on(el.confirmOkBtn, "click", confirmPendingAction);
    on(el.confirmCancelBtn, "click", cancelPendingAction);
    on(el.confirmBackdrop, "keydown", handleDialogKeydown);

    // Prevent the browser from navigating away when a file is dropped outside a zone
    on(document, "dragover", function (event) {
      event.preventDefault();
    });
    on(document, "drop", function (event) {
      event.preventDefault();
    });

    updateCustomFieldVisibility();
    updateCharacterCounts();
    updateReadiness();
    renderOutput();
  }

  /** Apply CDN-global library configuration and report availability. */
  function initializeDependencies() {
    if (typeof window.pdfjsLib !== "undefined" && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + APP_CONFIG.pdfjsVersion + "/pdf.worker.min.js";
    }
  }

  /* ======================================================================
     5. THEME
     ====================================================================== */

  function initializeTheme() {
    var theme = "dark";
    try {
      var stored = window.localStorage.getItem(APP_CONFIG.themeStorageKey);
      if (stored === "dark" || stored === "light") theme = stored;
    } catch (err) {
      // localStorage may be unavailable (privacy mode, file:// restrictions).
    }
    applyTheme(theme, false);
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-bs-theme", theme);
    var isDark = theme === "dark";
    el.themeIcon.textContent = isDark ? "\u2600" : "\u263E";
    var label = isDark ? "Switch to light theme" : "Switch to dark theme";
    el.themeToggle.setAttribute("aria-pressed", isDark ? "false" : "true");
    el.themeToggle.setAttribute("title", label);
    el.themeToggleLabel.textContent = label;
    if (persist) {
      try {
        window.localStorage.setItem(APP_CONFIG.themeStorageKey, theme);
      } catch (err) {
        // Theme persistence is optional; failure is not user-visible.
      }
    }
  }

  function toggleTheme() {
    var next = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    applyTheme(next, true);
    showToast("Switched to " + next + " theme.", "info");
  }

  /* ======================================================================
     6. COLLAPSIBLE CARDS
     ====================================================================== */

  function toggleCard(btn) {
    var bodyId = btn.getAttribute("data-collapse");
    var body = byId(bodyId);
    if (!body) return;
    var expanded = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", expanded ? "false" : "true");
    body.hidden = expanded;
    var chevron = btn.querySelector(".cr-chevron");
    if (chevron) chevron.classList.toggle("open", !expanded);
  }

  function expandAllCards() {
    Array.prototype.slice.call(document.querySelectorAll("[data-collapse]")).forEach(function (btn) {
      btn.setAttribute("aria-expanded", "true");
      var body = byId(btn.getAttribute("data-collapse"));
      if (body) body.hidden = false;
      var chevron = btn.querySelector(".cr-chevron");
      if (chevron) chevron.classList.add("open");
    });
  }

  /* ======================================================================
     7. FORM COLLECTION
     ====================================================================== */

  function val(id) {
    var node = byId(id);
    return node ? node.value : "";
  }

  function checkbox(id) {
    var node = byId(id);
    return !!(node && node.checked);
  }

  function selectedLength() {
    var checked = document.querySelector('input[name="preferencesLength"]:checked');
    return checked ? checked.value : "standard";
  }

  /**
   * Read every form control into a plain, JSON-friendly object that mirrors
   * the documented payload schema. Missing optional values become null.
   */
  function collectFormData() {
    return {
      masterInstructions: {
        text: el.instructionsText.value,
        locked: appState.instructions.locked,
        included: appState.instructions.included
      },
      recipient: {
        fullName: val("recipientFullName"),
        title: val("recipientTitle"),
        company: val("recipientCompany"),
        email: val("recipientEmail"),
        linkedinUrl: orNull(val("recipientLinkedin")),
        companyWebsite: orNull(val("recipientCompanyWebsite")),
        team: orNull(val("recipientTeam")),
        backgroundNotes: orNull(val("recipientBackground"))
      },
      candidate: {
        fullName: orNull(val("candidateFullName")),
        email: orNull(val("candidateEmail")),
        phone: orNull(val("candidatePhone")),
        linkedinUrl: orNull(val("candidateLinkedin")),
        portfolioUrl: orNull(val("candidatePortfolio")),
        githubUrl: orNull(val("candidateGithub")),
        location: orNull(val("candidateLocation")),
        targetRole: orNull(val("candidateTargetRole")),
        additionalContext: orNull(val("candidateContext")),
        resumeText: normalize(el.resumeText.value)
      },
      opportunity: {
        targetRole: orNull(val("opportunityTargetRole")),
        jobDescription: orNull(val("opportunityJobDescription")),
        jobPostingUrl: orNull(val("opportunityJobUrl")),
        requiredSkills: orNull(val("opportunityRequiredSkills")),
        industry: orNull(val("opportunityIndustry")),
        experienceLevel: orNull(val("opportunityExperience")),
        additionalContext: orNull(val("opportunityHiringContext"))
      },
      preferences: {
        objective: val("preferencesObjective"),
        customObjective: orNull(val("preferencesObjectiveCustom")),
        tone: val("preferencesTone"),
        customTone: orNull(val("preferencesToneCustom")),
        length: selectedLength(),
        language: orNull(val("preferencesLanguage")),
        signOff: orNull(val("preferencesSignOff")),
        achievementsToEmphasize: orNull(val("preferencesAchievements")),
        callToAction: orNull(val("preferencesCallToAction")),
        phrasesToAvoid: orNull(val("preferencesAvoidPhrases")),
        includeNetworkingAlternative: checkbox("prefIncludeNetworking"),
        includeReferralAlternative: checkbox("prefIncludeReferral"),
        includeShortVersion: checkbox("prefIncludeShort")
      },
      research: {
        mode: val("researchMode"),
        recipientProfileUrl: orNull(val("researchRecipientProfile")),
        companyWebsite: orNull(val("researchCompanyWebsite")),
        knownInitiatives: orNull(val("researchInitiatives")),
        recentDevelopments: orNull(val("researchDevelopments")),
        relationshipContext: orNull(val("researchRelationship")),
        notes: orNull(val("researchNotes"))
      },
      additionalContext: {
        previousCorrespondence: orNull(val("additionalPrevious")),
        motivation: orNull(val("additionalMotivation")),
        strongestSellingPoint: orNull(val("additionalSellingPoint")),
        resumeConcerns: orNull(val("additionalResumeConcerns")),
        instructions: orNull(val("additionalInstructions"))
      }
    };
  }

  /* ======================================================================
     8. VALIDATION
     ====================================================================== */

  /**
   * Validate the form. Returns an array of { field, label, message }.
   * Only genuinely required inputs block generation; every other field is
   * either optional or validated only when the user has typed something.
   */
  function validateForm(formData) {
    var issues = [];
    var r = formData.recipient;
    var c = formData.candidate;

    if (!hasText(r.fullName)) {
      issues.push({ field: "recipientFullName", label: "Contact full name", message: "Enter the recipient's full name." });
    }
    if (!hasText(r.title)) {
      issues.push({ field: "recipientTitle", label: "Current position / title", message: "Enter the recipient's current title." });
    }
    if (!hasText(r.company)) {
      issues.push({ field: "recipientCompany", label: "Company name", message: "Enter the company name." });
    }
    if (!hasText(r.email)) {
      issues.push({ field: "recipientEmail", label: "Contact email address", message: "Enter a contact email address." });
    } else if (!isValidEmail(r.email)) {
      issues.push({ field: "recipientEmail", label: "Contact email address", message: "Enter a valid email address, for example name@company.com." });
    }
    if (!hasText(formData.candidate.resumeText)) {
      issues.push({ field: "resumeText", label: "Resume content", message: "Import a PDF/DOCX/TXT resume or paste the resume text." });
    }

    // Optional fields are validated only when filled in.
    if (c.email && !isValidEmail(c.email)) {
      issues.push({ field: "candidateEmail", label: "Candidate email", message: "That email address does not look valid." });
    }

    var urlFields = [
      ["recipientLinkedin", "LinkedIn profile URL", r.linkedinUrl],
      ["recipientCompanyWebsite", "Company website URL", r.companyWebsite],
      ["candidateLinkedin", "Candidate LinkedIn URL", c.linkedinUrl],
      ["candidatePortfolio", "Portfolio URL", c.portfolioUrl],
      ["candidateGithub", "GitHub URL", c.githubUrl],
      ["opportunityJobUrl", "Job posting URL", formData.opportunity.jobPostingUrl],
      ["researchRecipientProfile", "Recipient profile URL", formData.research.recipientProfileUrl],
      ["researchCompanyWebsite", "Company website (research)", formData.research.companyWebsite]
    ];
    urlFields.forEach(function (entry) {
      if (entry[2] && !isValidUrl(entry[2])) {
        issues.push({ field: entry[0], label: entry[1], message: "Enter a plausible URL, for example https://example.com/page." });
      }
    });

    return issues;
  }

  function showFieldError(fieldId, message) {
    var errorId = FIELD_IDS[fieldId];
    var input = byId(fieldId);
    if (!input) return;
    var wrapper = input.closest(".cr-field");
    if (wrapper) wrapper.classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    if (errorId) {
      var errorNode = byId(errorId);
      if (errorNode) {
        errorNode.textContent = message;
        errorNode.hidden = false;
      }
    }
  }

  function clearFieldError(fieldId) {
    if (!fieldId || !FIELD_IDS[fieldId]) return;
    var input = byId(fieldId);
    var wrapper = input ? input.closest(".cr-field") : null;
    if (wrapper) wrapper.classList.remove("has-error");
    if (input) input.setAttribute("aria-invalid", "false");
    var errorNode = byId(FIELD_IDS[fieldId]);
    if (errorNode) {
      errorNode.textContent = "";
      errorNode.hidden = true;
    }
  }

  function clearAllFieldErrors() {
    Object.keys(FIELD_IDS).forEach(clearFieldError);
  }

  /** Render inline errors for every issue and focus the first offender. */
  function renderValidationErrors(issues) {
    clearAllFieldErrors();
    issues.forEach(function (issue) {
      showFieldError(issue.field, issue.message);
    });
    if (issues.length) {
      var first = byId(issues[0].field);
      if (first) {
        var collapsed = first.closest(".cr-card-body");
        if (collapsed && collapsed.hidden) {
          var header = document.querySelector('[data-collapse="' + collapsed.id + '"]');
          if (header) toggleCard(header);
        }
        first.focus();
        first.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }

  /* ---------------------------------------------------------------------
     Required-field progress + per-card state
     --------------------------------------------------------------------- */

  // The five fields that block generation, in the order they appear.
  var REQUIRED_PROGRESS = [
    { id: "recipientFullName", label: "contact name" },
    { id: "recipientTitle", label: "position" },
    { id: "recipientCompany", label: "company" },
    { id: "recipientEmail", label: "email", check: isValidEmail },
    { id: "resumeText", label: "resume" }
  ];

  function fieldComplete(id, check) {
    var node = byId(id);
    var value = node ? String(node.value || "").trim() : "";
    return value.length > 0 && (!check || check(value));
  }

  function setCardState(node, textNode, complete, completeText, incompleteText) {
    if (!node) return;
    node.setAttribute("data-state", complete ? "complete" : "incomplete");
    var icon = node.querySelector("i");
    if (icon) icon.className = "bi " + (complete ? "bi-check-circle-fill" : "bi-circle");
    if (textNode) textNode.textContent = complete ? completeText : incompleteText;
  }

  /**
   * A quiet, always-visible readiness meter: how many of the five blocking
   * fields are filled, which are still missing, and whether Cards B and D are
   * complete. It never validates on typing; it only reports what is present.
   */
  function updateRequiredProgress() {
    if (!el.progressCount || !el.progressBar) return;

    var done = 0;
    var missing = [];

    REQUIRED_PROGRESS.forEach(function (item) {
      if (fieldComplete(item.id, item.check)) {
        done += 1;
      } else {
        missing.push(item.label);
      }
    });

    var total = REQUIRED_PROGRESS.length;
    var complete = done === total;

    el.progressCount.textContent = done + " of " + total;
    el.progressFill.style.width = (done / total) * 100 + "%";
    el.progressBar.setAttribute("aria-valuenow", String(done));
    el.progressBar.setAttribute(
      "aria-valuetext",
      done + " of " + total + " required fields complete"
    );
    el.progressHint.textContent = complete
      ? "All required fields are complete \u2014 ready to generate."
      : "Still needed: " + missing.join(", ") + ".";
    if (el.progress) el.progress.classList.toggle("is-complete", complete);

    var recipientComplete =
      fieldComplete("recipientFullName") &&
      fieldComplete("recipientTitle") &&
      fieldComplete("recipientCompany") &&
      fieldComplete("recipientEmail", isValidEmail);
    setCardState(el.cardStateB, el.cardStateBText, recipientComplete, "Ready", "Missing info");
    setCardState(
      el.cardStateD,
      el.cardStateDText,
      fieldComplete("resumeText"),
      "Ready",
      "Resume needed"
    );
  }

  function updateReadiness() {
    updateRequiredProgress();
    var issues = validateForm(collectFormData());
    var ready = issues.length === 0;

    if (!appState.hasGenerated) {
      setReadiness(ready ? "ready" : "missing", ready ? "Ready" : "Not generated");
      el.outputStatusText.textContent = ready
        ? "Ready \u2014 every required field is present. Click Generate Plugin Input."
        : issues.length + " required field" + (issues.length === 1 ? "" : "s") +
          " still missing: " + issues.map(function (i) { return i.label; }).join(", ") + ".";
    } else if (!ready) {
      setReadiness("missing", "Out of date");
      el.outputStatusText.textContent =
        "Inputs changed since the last generation and required fields are now missing (" +
        issues.map(function (i) { return i.label; }).join(", ") +
        "). The output shown is from the earlier generation and is no longer current.";
    } else if (!appState.outputIsCurrent) {
      setReadiness("generated", "Generated");
      el.outputStatusText.textContent = "Generated \u2014 refreshed automatically from your latest edits.";
    } else {
      setReadiness("generated", "Generated");
      el.outputStatusText.textContent =
        "Generated. This assembles an input package only \u2014 it does not send email, run research, or call an AI.";
    }

    // Validation summary strip
    if (issues.length && !appState.hasGenerated && appState.validationRequested) {
      el.validationSummaryText.textContent =
        "Missing or invalid required inputs: " + issues.map(function (i) { return i.label; }).join(", ") + ".";
      el.validationSummary.hidden = false;
    } else {
      el.validationSummary.hidden = true;
      el.validationSummaryText.textContent = "";
    }
    return { issues: issues, ready: ready };
  }

  function setReadiness(kind, text) {
    var icons = { generated: "bi-check-circle", ready: "bi-info-circle", missing: "bi-exclamation-circle" };
    if (el.outputReadiness.getAttribute("data-kind") !== kind) {
      el.outputReadiness.setAttribute("data-kind", kind);
      el.outputReadiness.className = "cr-readiness " + kind;
      el.outputReadinessIcon.className = "bi " + (icons[kind] || icons.missing);
    }
    el.outputReadinessText.textContent = text;
  }

  /* ======================================================================
     9. PROMPT ASSEMBLY
     ====================================================================== */

  /**
   * Build the structured JSON payload. Missing optional values are `null`.
   * Serialisation is always performed with JSON.stringify (never by string
   * concatenation), and the result always parses.
   */
  function buildJson(formData) {
    var r = formData.recipient;
    var c = formData.candidate;
    var o = formData.opportunity;
    var p = formData.preferences;
    var rs = formData.research;
    var a = formData.additionalContext;

    return {
      product: APP_CONFIG.productName,
      generatedAt: new Date().toISOString(),
      masterInstructions: {
        included: formData.masterInstructions.included,
        text: formData.masterInstructions.included ? normalize(formData.masterInstructions.text) : null
      },
      recipient: {
        fullName: normalize(r.fullName),
        title: normalize(r.title),
        company: normalize(r.company),
        email: normalize(r.email),
        linkedinUrl: orNull(r.linkedinUrl),
        companyWebsite: orNull(r.companyWebsite),
        team: orNull(r.team),
        backgroundNotes: orNull(r.backgroundNotes)
      },
      candidate: {
        fullName: orNull(c.fullName),
        email: orNull(c.email),
        phone: orNull(c.phone),
        linkedinUrl: orNull(c.linkedinUrl),
        portfolioUrl: orNull(c.portfolioUrl),
        githubUrl: orNull(c.githubUrl),
        location: orNull(c.location),
        targetRole: orNull(c.targetRole),
        additionalContext: orNull(c.additionalContext),
        resumeText: orNull(c.resumeText)
      },
      opportunity: {
        targetRole: orNull(o.targetRole),
        jobDescription: orNull(o.jobDescription),
        jobPostingUrl: orNull(o.jobPostingUrl),
        requiredSkills: orNull(o.requiredSkills),
        industry: orNull(o.industry),
        experienceLevel: orNull(o.experienceLevel),
        additionalContext: orNull(o.additionalContext)
      },
      preferences: {
        objective: p.objective,
        customObjective: p.objective === "custom" ? orNull(p.customObjective) : null,
        tone: p.tone,
        customTone: p.tone === "custom" ? orNull(p.customTone) : null,
        length: p.length,
        language: orNull(p.language),
        signOff: orNull(p.signOff),
        achievementsToEmphasize: orNull(p.achievementsToEmphasize),
        callToAction: orNull(p.callToAction),
        phrasesToAvoid: orNull(p.phrasesToAvoid),
        includeNetworkingAlternative: !!p.includeNetworkingAlternative,
        includeReferralAlternative: !!p.includeReferralAlternative,
        includeShortVersion: !!p.includeShortVersion
      },
      research: {
        mode: rs.mode,
        recipientProfileUrl: orNull(rs.recipientProfileUrl),
        companyWebsite: orNull(rs.companyWebsite),
        knownInitiatives: orNull(rs.knownInitiatives),
        recentDevelopments: orNull(rs.recentDevelopments),
        relationshipContext: orNull(rs.relationshipContext),
        notes: orNull(rs.notes)
      },
      additionalContext: {
        previousCorrespondence: orNull(a.previousCorrespondence),
        motivation: orNull(a.motivation),
        strongestSellingPoint: orNull(a.strongestSellingPoint),
        resumeConcerns: orNull(a.resumeConcerns),
        instructions: orNull(a.instructions)
      },
      requestedOutputs: [
        "outreach_strategy",
        "subject_lines",
        "primary_email",
        "alternative_email",
        "resume_fit_assessment",
        "resume_improvements",
        "recommended_next_steps"
      ],
      disclosures: {
        dataSource: "All values above were supplied by the user in the browser interface.",
        researchPerformed: false,
        researchNote:
          "No live web research was performed and no recipient profile, company website, or job posting was fetched. URL fields are references the user typed, not pages this tool read.",
        absenceNote:
          "A null value means the user did not provide that information. It is unknown, not confirmed absent.",
        aiNote: "This tool did not generate any career advice or email copy. It assembles input for a downstream AI tool chosen by the user.",
        privacyNote: "No form data, document content, or personal information left this device."
      }
    };
  }

  /** Human-readable brief. Sections 1-8 carry facts; section 9 states the task. */
  function buildPlainText(formData) {
    var m = formData.masterInstructions;
    var r = formData.recipient;
    var c = formData.candidate;
    var o = formData.opportunity;
    var p = formData.preferences;
    var rs = formData.research;
    var a = formData.additionalContext;
    var out = [];

    out.push(APP_CONFIG.productName.toUpperCase() + " \u2014 PLUGIN INPUT PACKAGE");
    out.push("=".repeat(62));
    out.push("");
    out.push("Generated: " + new Date().toLocaleString() + " (assembled locally in the browser)");
    out.push("Provenance: every value below was supplied by the user in the interface. No web research and");
    out.push("no AI analysis was performed by this tool. \"[Not provided]\" means unknown \u2014 it does not mean");
    out.push("the item was checked and found absent.");
    out.push("");

    // 1. Master instructions
    out.push("1. MASTER INSTRUCTIONS");
    out.push("-".repeat(42));
    if (m.included) {
      out.push(normalize(m.text));
    } else {
      out.push("[Master instructions were excluded by the user. Apply only the sections below.]");
    }
    out.push("");

    // 2. Recipient & company
    out.push("2. RECIPIENT AND COMPANY (user-provided facts)");
    out.push("-".repeat(42));
    out.push(line("Contact full name", r.fullName));
    out.push(line("Current position/title", r.title));
    out.push(line("Company", r.company));
    out.push(line("Contact email", r.email));
    out.push(line("LinkedIn profile URL (reference only, not visited)", r.linkedinUrl));
    out.push(line("Company website (reference only, not visited)", r.companyWebsite));
    out.push(line("Team or department", r.team));
    out.push(line("Recipient background notes supplied by the user", r.backgroundNotes));
    out.push("");

    // 3. Candidate profile
    out.push("3. CANDIDATE PROFILE (user-provided facts)");
    out.push("-".repeat(42));
    out.push(line("Full name", c.fullName));
    out.push(line("Email", c.email));
    out.push(line("Phone", c.phone));
    out.push(line("LinkedIn URL", c.linkedinUrl));
    out.push(line("Portfolio URL", c.portfolioUrl));
    out.push(line("GitHub URL", c.githubUrl));
    out.push(line("Location or target job market", c.location));
    out.push(line("Target role/title", c.targetRole));
    out.push(line("Additional achievements or context supplied by the user", c.additionalContext));
    out.push("");

    // 4. Resume
    out.push("4. RESUME (full supplied text, unedited)");
    out.push("-".repeat(42));
    if (hasText(c.resumeText)) {
      out.push(normalize(c.resumeText));
    } else {
      out.push("[No resume text was provided. Do not invent resume content.]");
    }
    out.push("");

    // 5. Target opportunity
    out.push("5. TARGET OPPORTUNITY");
    out.push("-".repeat(42));
    out.push(line("Target role/title", o.targetRole));
    out.push(line("Job posting URL (reference only, not visited)", o.jobPostingUrl));
    out.push(line("Required skills or qualifications as supplied", o.requiredSkills));
    out.push(line("Industry or domain", o.industry));
    out.push(line("Experience level", o.experienceLevel));
    out.push(line("Additional hiring context", o.additionalContext));
    out.push("");
    if (hasText(o.jobDescription)) {
      out.push("Job description (full supplied text, unedited):");
      out.push(normalize(o.jobDescription));
    } else {
      out.push("Job description: [Not provided.]");
      out.push("Because no job description was supplied, run a clearly labelled HEURISTIC assessment against");
      out.push("the target role/title using only the supplied evidence. Do not claim to know the actual hiring");
      out.push("criteria, and label every inferred expectation as inferred rather than confirmed.");
    }
    out.push("");

    // 6. Outreach preferences
    out.push("6. OUTREACH PREFERENCES");
    out.push("-".repeat(42));
    var objective = p.objective === "custom" && hasText(p.customObjective)
      ? normalize(p.customObjective) + " (custom objective)"
      : p.objective.replace(/_/g, " ");
    var tone = p.tone === "custom" && hasText(p.customTone)
      ? normalize(p.customTone) + " (custom tone)"
      : p.tone.replace(/_/g, " ");
    out.push("Objective: " + objective);
    out.push("Tone: " + tone);
    out.push("Email length: " + lengthLabel(p.length));
    out.push(line("Preferred language", p.language));
    out.push(line("Preferred sign-off", p.signOff));
    out.push(line("Achievements to emphasize", p.achievementsToEmphasize));
    out.push(line("Desired call to action", p.callToAction));
    out.push(line("Phrases or styles to avoid", p.phrasesToAvoid));
    out.push("Include a networking alternative: " + (p.includeNetworkingAlternative ? "Yes" : "No"));
    out.push("Include a referral-request alternative: " + (p.includeReferralAlternative ? "Yes" : "No"));
    out.push("Include a shorter version: " + (p.includeShortVersion ? "Yes" : "No"));
    out.push("");

    // 7. Research & personalization
    out.push("7. RESEARCH AND PERSONALIZATION");
    out.push("-".repeat(42));
    out.push(line("Research mode", rs.mode === "research_enabled"
      ? "research-enabled mode requested"
      : "user-supplied information only"));
    out.push("Transparency requirement: this tool performed no live research and opened no page. Use only the");
    out.push("user-supplied material below for personalization. Do not state or imply that any profile, website,");
    out.push("or posting was visited or verified. If personalization material is insufficient, say so explicitly");
    out.push("and list the resulting personalization limitations before drafting.");
    out.push(line("Recipient profile URL (user-supplied reference, not visited)", rs.recipientProfileUrl));
    out.push(line("Company website (user-supplied reference, not visited)", rs.companyWebsite));
    out.push(line("Known company projects or initiatives", rs.knownInitiatives));
    out.push(line("Recent developments supplied by the user", rs.recentDevelopments));
    out.push(line("Existing relationship or shared context", rs.relationshipContext));
    out.push(line("Research notes", rs.notes));
    out.push("Privacy constraint: do not infer or reference sensitive personal traits about the recipient.");
    out.push("");

    // 8. Additional context
    out.push("8. ADDITIONAL CONTEXT");
    out.push("-".repeat(42));
    out.push(line("Previous correspondence", a.previousCorrespondence));
    out.push(line("Why the candidate wants to contact this company", a.motivation));
    out.push(line("Strongest selling point", a.strongestSellingPoint));
    out.push(line("Specific resume concerns", a.resumeConcerns));
    out.push(line("Additional instructions", a.instructions));
    out.push("");

    // 9. Required output
    out.push("9. REQUIRED OUTPUT");
    out.push("-".repeat(42));
    out.push("Return the following seven sections, in this order:");
    out.push("1) Outreach Strategy \u2014 the recipient approach, supported personalization opportunities, the objective, and the rationale.");
    out.push("2) Subject Lines \u2014 two or three options and one recommended subject line with a reason.");
    out.push("3) Primary Cold Email \u2014 tailored to the objective, tone, and length above, with a single clear call to action and a sign-off.");
    out.push("4) Alternative Email \u2014 a genuinely different approach, honouring the networking, referral, and shorter-version preferences above.");
    out.push("5) Resume Fit Assessment \u2014 evidence-based analysis with cited evidence and stated uncertainty.");
    out.push("6) Resume Improvements \u2014 specific, actionable changes supported by the supplied resume and opportunity information.");
    out.push("7) Recommended Next Steps \u2014 realistic, prioritised actions.");
    out.push("");
    out.push("Resume fit rubric (100-point heuristic):");
    out.push("- Relevant experience and responsibilities: 30");
    out.push("- Skills and tools explicitly evidenced: 25");
    out.push("- Achievements and measurable impact: 20");
    out.push("- Industry/domain alignment: 15");
    out.push("- Relevant education and certifications: 10");
    out.push("");
    out.push("Explain the rationale behind each score, cite the supporting resume evidence, and distinguish missing");
    out.push("evidence from a demonstrated lack of ability. Clearly label assumptions and uncertainties. State that");
    out.push("the score is a heuristic and not a prediction of hiring success. Never fabricate accomplishments,");
    out.push("skills, employers, certifications, relationships, job openings, or recipient details, and never");
    out.push("overstate alignment with the role.");
    out.push("");
    return out.join("\n");
  }

  function lengthLabel(length) {
    if (length === "short") return "Short (60-100 words)";
    if (length === "detailed") return "Detailed (170-250 words)";
    return "Standard (100-170 words)";
  }

  /**
   * Assemble the plugin input for the requested output mode.
   * Returns every variant plus size metrics so the UI can warn honestly.
   */
  function buildPluginInput(formData, outputMode) {
    var issues = validateForm(formData);
    var prompt = buildPlainText(formData);
    var json = JSON.stringify(buildJson(formData), null, 2);

    var complete = [
      "#####################  PLAIN-TEXT PROMPT  #####################",
      "",
      prompt,
      "",
      "#####################  STRUCTURED JSON  #####################",
      "",
      json
    ].join("\n");

    var mode = outputMode || appState.outputMode;
    var content = mode === "json" ? json : mode === "prompt" ? prompt : complete;

    return {
      ok: issues.length === 0,
      issues: issues,
      outputMode: mode,
      prompt: prompt,
      json: json,
      complete: complete,
      content: content,
      totalChars: complete.length,
      overLimit: complete.length > APP_CONFIG.contextLimitChars
    };
  }

  /* ======================================================================
     10. OUTPUT RENDERING
     ====================================================================== */

  function modeLabel(mode) {
    if (mode === "json") return "Structured JSON";
    if (mode === "prompt") return "Plain Text";
    return "Complete Prompt";
  }

  function setOutputMode(mode) {
    appState.outputMode = mode;
    el.tabs.forEach(function (tab) {
      var active = tab.getAttribute("data-mode") === mode;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
      if (active) tab.classList.add("active"); else tab.classList.remove("active");
    });
    el.outputModeLabel.textContent = modeLabel(mode);
    if (!appState.hasGenerated) {
      el.outputStatusText.textContent =
        "Format set to " + modeLabel(mode) + ", but nothing has been generated yet. Click Generate Plugin Input.";
    }
    renderOutput();
    // Readiness text is mode-independent, so recompute it after switching.
    if (appState.hasGenerated) updateReadiness();
  }

  function handleTabKeydown(event) {
    var keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (keys.indexOf(event.key) === -1) return;
    event.preventDefault();
    var index = el.tabs.indexOf(event.currentTarget);
    var next = index;
    if (event.key === "ArrowRight") next = (index + 1) % el.tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + el.tabs.length) % el.tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = el.tabs.length - 1;
    el.tabs[next].focus();
    setOutputMode(el.tabs[next].getAttribute("data-mode"));
  }

  function renderOutput() {
    if (!appState.hasGenerated) {
      el.outputText.value = "";
      el.outputCount.textContent = fmtCount(0);
      el.outputWarn.hidden = true;
      el.outputWarn.textContent = "";
      // The friendly empty state covers the textarea, so keep the (invisible)
      // textarea out of the tab order until there is something to read.
      if (el.outputEmpty) el.outputEmpty.hidden = false;
      el.outputText.setAttribute("tabindex", "-1");
      appState.built = null;
      appState.overLimit = false;
      return null;
    }

    var built = buildPluginInput(collectFormData(), appState.outputMode);
    appState.built = built;

    var previousScroll = el.outputText.scrollTop;
    el.outputText.value = built.content;
    el.outputText.scrollTop = previousScroll;
    el.outputCount.textContent = fmtCount(built.content.length);
    if (el.outputEmpty) el.outputEmpty.hidden = true;
    el.outputText.removeAttribute("tabindex");

    // Size warning: shown for the modes that carry the full package.
    if (built.overLimit && appState.outputMode !== "json") {
      el.outputWarn.hidden = false;
      el.outputWarn.textContent =
        "Large payload: the complete package is " + fmtCount(built.totalChars) +
        ", which is above the " + fmtCount(APP_CONFIG.contextLimitChars) +
        " guideline. Nothing was truncated. Consider downloading the JSON on its own, or trimming the resume text if your downstream tool has a context limit.";
    } else {
      el.outputWarn.hidden = true;
      el.outputWarn.textContent = "";
    }
    appState.overLimit = built.overLimit;
    return built;
  }

  /**
   * React to any form change.
   *  - While the inputs are complete, the visible output is rebuilt from the
   *    current values, so it is never silently stale.
   *  - If a change makes required fields invalid, the last good output is kept
   *    on screen but explicitly marked out of date, and downloads are blocked.
   */
  function handleFormMutation() {
    if (!appState.hasGenerated) {
      renderOutput();
      updateReadiness();
      return;
    }

    var result = updateReadiness();
    if (result.ready) {
      appState.outputIsCurrent = true;
      renderOutput();
    } else {
      appState.outputIsCurrent = false;
    }
    updateReadiness();
  }

  function updateCharacterCounts() {
    el.instructionsCount.textContent = fmtCount(el.instructionsText.value.length);
    el.resumeCount.textContent = fmtCount(el.resumeText.value.length);
    el.opportunityCount.textContent = fmtCount(el.opportunityJobDescription.value.length);
    el.outputCount.textContent = fmtCount(el.outputText.value.length);
  }

  /* ======================================================================
     11. CARD A — MASTER INSTRUCTIONS
     ====================================================================== */

  function handleLockToggle() {
    var locked = el.lockToggle.checked;
    appState.instructions.locked = locked;
    el.instructionsText.readOnly = locked;
    el.lockStatusText.textContent = locked ? "Locked" : "Unlocked";
    showToast(locked ? "Master instructions locked (read-only)." : "Master instructions unlocked \u2014 editing enabled.", "info");
    updateReadiness();
  }

  function handleIncludeToggle() {
    var included = el.includeInstructions.checked;
    appState.instructions.included = included;
    showToast(included
      ? "Master instructions will be included in the output."
      : "Master instructions excluded from the output. Your text is kept.", "info");
    handleFormMutation();
  }

  function resetInstructionsToDefault() {
    el.instructionsText.value = DEFAULT_INSTRUCTIONS;
    appState.instructions.locked = true;
    el.lockToggle.checked = true;
    el.instructionsText.readOnly = true;
    el.lockStatusText.textContent = "Locked";
    updateCharacterCounts();
    showToast("Master instructions restored to the default text and re-locked.", "success");
    handleFormMutation();
  }

  /* ======================================================================
     12. FILE IMPORT AND TEXT EXTRACTION
     ====================================================================== */

  var ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

  /** Map a File to one of "pdf" | "docx" | "txt" | "unknown" (never network). */
  function detectKind(file) {
    var type = (file.type || "").toLowerCase();
    if (type === "application/pdf") return "pdf";
    if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
    if (type === "text/plain") return "txt";
    var name = (file.name || "").toLowerCase();
    if (/\.pdf$/.test(name)) return "pdf";
    if (/\.docx$/.test(name)) return "docx";
    if (/\.txt$/.test(name)) return "txt";
    return "unknown";
  }

  function bindDropzone(zone, input, target) {
    on(zone, "click", function (event) {
      if (event.target.closest(".cr-browse-btn")) {
        event.preventDefault();
        return; // the browse button opens the picker itself
      }
      input.click();
    });
    on(zone, "keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });
    var browse = zone.querySelector(".cr-browse-btn");
    on(browse, "click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      input.click();
    });
    on(zone, "dragenter", function (event) {
      event.preventDefault();
      zone.classList.add("dragging");
    });
    on(zone, "dragover", function (event) {
      event.preventDefault();
      zone.classList.add("dragging");
    });
    on(zone, "dragleave", function (event) {
      if (event.target === zone) zone.classList.remove("dragging");
    });
    on(zone, "drop", function (event) {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove("dragging");
      var files = event.dataTransfer ? event.dataTransfer.files : null;
      if (!files || !files.length) {
        setTargetStatus(target, "error", "No file was detected in that drop. Drop a single .pdf, .docx or .txt file.");
        return;
      }
      if (files.length > 1) {
        showToast("Multiple files were dropped. Only the first file (" + files[0].name + ") will be imported.", "info");
      }
      handleFileUpload(files[0], target);
    });
  }

  function submitFileInput(input, target) {
    var file = input.files && input.files[0];
    input.value = ""; // allow re-selecting the same file later
    if (!file) return;
    handleFileUpload(file, target);
  }

  /**
   * Validate an uploaded file and route it to the correct extractor.
   * Existing text is never discarded without confirmation.
   */
  function handleFileUpload(file, target) {
    var label = target === "resume" ? "resume" : "job description";

    if (!file) return;

    // 1. Basic validation before any reading happens.
    if (file.size === 0) {
      setTargetStatus(target, "error", "That file is empty (0 bytes), so there is nothing to import.");
      return;
    }
    if (file.size > APP_CONFIG.maxFileBytes) {
      setTargetStatus(target, "error",
        "That file is " + formatFileSize(file.size) + ", which is over the " +
        formatFileSize(APP_CONFIG.maxFileBytes) + " limit. Nothing was imported.");
      return;
    }
    var kind = detectKind(file);
    if (kind === "unknown") {
      setTargetStatus(target, "error",
        "Unsupported file type \"" + (file.type || "unknown") + "\". Accepted formats: " +
        ACCEPTED_EXTENSIONS.join(", ") + ". Note that a file extension alone does not guarantee the contents are valid.");
      return;
    }

    // 2. Replacement confirmation when content would be discarded.
    var textarea = target === "resume" ? el.resumeText : el.opportunityJobDescription;
    var record = target === "resume" ? appState.resume : appState.jobDescription;
    var currentText = textarea.value;
    var edited = currentText !== record.extractedText;
    var hasContent = hasText(currentText);

    if (hasContent) {
      var body = record.fileName
        ? "This " + label + " field already contains \"" + record.fileName + "\" (" + formatFileSize(record.fileSize) + ")."
        : "This " + label + " field already contains text you entered.";
      body += "\n\nImporting \"" + file.name + "\" will replace the current text in the " + label +
        " field only. The other field is not affected.";
      if (edited) {
        body += "\n\nYou have edited this text since it was imported, so those manual edits will be lost.";
      }
      openConfirm({
        title: "Replace the current " + label + " text?",
        body: body,
        confirmLabel: "Replace and import",
        destructive: true,
        onConfirm: function () {
          extractInto(file, kind, target);
        }
      });
      return;
    }

    extractInto(file, kind, target);
  }

  /** Run the correct extractor and apply the result to the target field. */
  function extractInto(file, kind, target) {
    setTargetStatus(target, "info", "Reading \"" + file.name + "\" locally\u2026");

    var promise;
    if (kind === "txt") {
      promise = extractTextFromTXT(file);
    } else if (kind === "pdf") {
      promise = extractTextFromPDF(file);
    } else {
      promise = extractTextFromDOCX(file);
    }

    promise.then(function (result) {
      applyExtractionResult(result, file, target);
    }).catch(function (error) {
      var message = error && error.message ? error.message : String(error);
      setTargetStatus(target, "error",
        "Extraction failed: " + message +
        " Nothing in the " + (target === "resume" ? "resume" : "job description") +
        " field was changed. You can paste the text manually instead.");
    });
  }

  function applyExtractionResult(result, file, target) {
    var textarea = target === "resume" ? el.resumeText : el.opportunityJobDescription;
    var record = target === "resume" ? appState.resume : appState.jobDescription;
    var label = target === "resume" ? "resume" : "job description";

    if (!result.ok) {
      // Existing content is deliberately left untouched on failure.
      setTargetStatus(target, "error", result.error);
      return;
    }

    textarea.value = result.text;
    record.extractedText = result.text;
    record.fileName = file.name;
    record.fileSize = file.size;
    renderFileChip(target);

    updateCharacterCounts();
    var note = "Imported " + formatFileSize(file.size) + " from \"" + file.name + "\" \u2014 " +
      fmtCount(result.text.length) + " extracted. Review and edit as needed; the text below is what gets sent.";
    setTargetStatus(target, "success", note);
    renderOutput();
    handleFormMutation();
  }

  function renderFileChip(target) {
    var record = target === "resume" ? appState.resume : appState.jobDescription;
    var row = target === "resume" ? el.resumeFileRow : el.jobDescFileRow;
    var nameNode = target === "resume" ? el.resumeFileName : el.jobDescFileName;
    var sizeNode = target === "resume" ? el.resumeFileSize : el.jobDescFileSize;
    if (record.fileName) {
      nameNode.textContent = record.fileName;
      sizeNode.textContent = "(" + formatFileSize(record.fileSize) + ")";
      row.hidden = false;
    } else {
      nameNode.textContent = "";
      sizeNode.textContent = "";
      row.hidden = true;
    }
  }

  function removeImportedFile(target) {
    var textarea = target === "resume" ? el.resumeText : el.opportunityJobDescription;
    var record = target === "resume" ? appState.resume : appState.jobDescription;
    var label = target === "resume" ? "resume" : "job description";

    var doRemove = function () {
      record.fileName = null;
      record.fileSize = null;
      record.extractedText = "";
      textarea.value = "";
      renderFileChip(target);
      setTargetStatus(target, "info",
        "The imported " + label + " file reference was removed and the " + label + " text was cleared.");
      updateCharacterCounts();
      handleFormMutation();
    };

    if (hasText(textarea.value)) {
      openConfirm({
        title: "Remove the " + label + " text?",
        body: "This clears the text currently in the " + label + " field and forgets the imported file name. This cannot be undone.",
        confirmLabel: "Remove text",
        destructive: true,
        onConfirm: doRemove
      });
    } else {
      doRemove();
    }
  }

  function setTargetStatus(target, kind, message) {
    var node = target === "resume" ? el.resumeStatus : el.jobDescStatus;
    node.className = "cr-status cr-status-" + kind;
    node.textContent = message;
    node.hidden = false;
  }

  /** TXT via the File API. */
  function extractTextFromTXT(file) {
    return file.text().then(function (text) {
      if (!hasText(text)) {
        return { ok: false, text: "", error: "That .txt file contains no usable text." };
      }
      return { ok: true, text: text };
    }).catch(function (error) {
      return {
        ok: false,
        text: "",
        error: "The .txt file could not be read: " + (error && error.message ? error.message : String(error)) + "."
      };
    });
  }

  /**
   * PDF extraction with PDF.js (selectable text only).
   * Detects the scanned/image-only case and says so instead of returning junk.
   */
  function extractTextFromPDF(file) {
    if (typeof window.pdfjsLib === "undefined") {
      return Promise.resolve({
        ok: false,
        text: "",
        error: "PDF.js is not available (the pinned CDN script did not load, usually because the browser is offline or the CDN is blocked). Paste your PDF text manually instead."
      });
    }

    return file.arrayBuffer().then(function (buffer) {
      return window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    }).then(function (doc) {
      var pageTexts = [];
      var chain = Promise.resolve();
      for (var i = 1; i <= doc.numPages; i++) {
        (function (pageNumber) {
          chain = chain.then(function () {
            return doc.getPage(pageNumber).then(function (page) {
              return page.getTextContent().then(function (content) {
                var text = content.items.map(function (item) {
                  return typeof item.str === "string" ? item.str : "";
                }).join(" ").replace(/\s+/g, " ").trim();
                if (text) pageTexts.push(text);
                return page.cleanup();
              });
            });
          });
        })(i);
      }
      return chain.then(function () {
        var totalPages = doc.numPages;
        return doc.destroy().then(function () {
          var text = pageTexts.join("\n\n").trim();
          if (!text) {
            return {
              ok: false,
              text: "",
              needsOcr: true,
              error: "No selectable text was found in this " + totalPages + "-page PDF. It is probably a scanned or image-only document, which requires OCR before its contents can be imported. Please paste the text manually, or run OCR first and then import the resulting PDF or text."
            };
          }
          return { ok: true, text: text };
        });
      });
    }).catch(function (error) {
      var message = error && error.message ? error.message : String(error);
      if (/password/i.test(message)) {
        return {
          ok: false,
          text: "",
          error: "This PDF is password-protected. Remove the password (or paste the text manually) and try again."
        };
      }
      if (/worker|Worker/i.test(message)) {
        return {
          ok: false,
          text: "",
          error: "The PDF could not be read because the PDF.js worker could not start (" + message +
            "). This commonly happens when a page is opened directly from disk with file://. Paste the PDF text manually instead."
        };
      }
      return { ok: false, text: "", error: "The PDF could not be read: " + message };
    });
  }

  /** DOCX extraction with Mammoth.js (raw text). */
  function extractTextFromDOCX(file) {
    if (typeof window.mammoth === "undefined") {
      return Promise.resolve({
        ok: false,
        text: "",
        error: "Mammoth.js is not available (the pinned CDN script did not load, usually because the browser is offline or the CDN is blocked). Paste your document text manually instead."
      });
    }

    return file.arrayBuffer().then(function (buffer) {
      return window.mammoth.extractRawText({ arrayBuffer: buffer });
    }).then(function (result) {
      var text = (result && result.value ? result.value : "").trim();
      if (!text) {
        return {
          ok: false,
          text: "",
          error: "No text could be extracted from that DOCX. It may contain only images or text boxes. Copy the text and paste it manually."
        };
      }
      return { ok: true, text: text };
    }).catch(function (error) {
      var message = error && error.message ? error.message : String(error);
      if (/zip|central directory|corrupt|end of central/i.test(message)) {
        return {
          ok: false,
          text: "",
          error: "That file is not a readable DOCX archive (it may be a renamed or corrupted file). Save it as a real .docx or paste the text manually."
        };
      }
      return { ok: false, text: "", error: "The DOCX could not be read: " + message };
    });
  }

  /* ======================================================================
     13. ACTIONS — GENERATE, COPY, DOWNLOAD
     ====================================================================== */

  function handleGenerate() {
    var formData = collectFormData();
    var issues = validateForm(formData);

    if (issues.length) {
      appState.validationRequested = true;
      renderValidationErrors(issues);
      updateReadiness();
      showToast(
        "Cannot generate yet. Fix " + issues.length + " field" + (issues.length === 1 ? "" : "s") +
        ", starting with: " + issues[0].label + " \u2014 " + issues[0].message,
        "error"
      );
      return;
    }

    clearAllFieldErrors();
    appState.validationRequested = false;
    appState.hasGenerated = true;
    appState.outputIsCurrent = true;
    var built = renderOutput();
    appState.overLimit = built.overLimit;
    updateReadiness();
    updateCharacterCounts();

    showToast("Plugin input assembled for the " + modeLabel(appState.outputMode) + " format.", "success");

    if (window.innerWidth < 992) {
      el.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /** Clipboard API with a legacy execCommand fallback; never fakes success. */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return legacyCopy(text);
      });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch (err) {
      return false;
    }
  }

  function copyOutput() {
    if (!appState.hasGenerated || !appState.built || !appState.built.content) {
      showToast("Nothing to copy yet. Generate the plugin input first.", "error");
      return;
    }
    var text = appState.built.content;
    copyToClipboard(text).then(function (ok) {
      if (ok) {
        showToast("Copied " + fmtCount(text.length) + " to the clipboard.", "success");
      } else {
        showToast(
          "Copy failed \u2014 the browser denied clipboard access. Select the output text manually and use Ctrl+C (Cmd+C on macOS).",
          "error"
        );
      }
    });
  }

  /**
   * Download the current output as ColdReach_Plugin_Input.txt.
   * Requires a current, successfully generated output.
   */
  function downloadText() {
    var guard = assertDownloadable();
    if (!guard.ok) {
      showToast(guard.message, "error");
      return;
    }
    triggerDownload(APP_CONFIG.downloadBaseName + ".txt", appState.built.content, "text/plain;charset=utf-8");
    showToast("Downloaded " + APP_CONFIG.downloadBaseName + ".txt (" + modeLabel(appState.outputMode) + ").", "success");
  }

  /**
   * Download ColdReach_Plugin_Input.json built from the CURRENT form state,
   * independent of the selected output mode. Parsed back to prove validity
   * before anything is written to disk.
   */
  function downloadJSON() {
    var guard = assertDownloadable();
    if (!guard.ok) {
      showToast(guard.message, "error");
      return;
    }
    var text;
    try {
      var payload = buildJson(collectFormData());
      text = JSON.stringify(payload, null, 2);
      JSON.parse(text); // validates before download
    } catch (err) {
      showToast("The JSON could not be serialised, so the download was cancelled.", "error");
      return;
    }
    triggerDownload(APP_CONFIG.downloadBaseName + ".json", text, "application/json;charset=utf-8");
    showToast("Downloaded " + APP_CONFIG.downloadBaseName + ".json (validated as parseable JSON).", "success");
  }

  function assertDownloadable() {
    if (!appState.hasGenerated) {
      return { ok: false, message: "Generate the plugin input first \u2014 the download needs validated input. Nothing was downloaded." };
    }
    if (!appState.outputIsCurrent) {
      return { ok: false, message: "The inputs changed after the last generation. Click Generate Plugin Input again before downloading, so you do not save an out-of-date payload." };
    }
    if (!appState.built || !appState.built.content) {
      return { ok: false, message: "There is no output to download yet." };
    }
    return { ok: true };
  }

  function triggerDownload(fileName, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Release the temporary object URL once the browser has started the download.
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ======================================================================
     14. CLEAR OPTIONAL INPUTS
     ====================================================================== */

  /**
   * Clear optional inputs only. Preserved: the four required recipient
   * fields, resume text and its imported file, and the master instructions
   * text with its lock/include state.
   */
  function clearOptionalInputs() {
    var cleared = [];

    // Recipient optional fields
    setValue("recipientLinkedin", "");
    setValue("recipientCompanyWebsite", "");
    setValue("recipientTeam", "");
    setValue("recipientBackground", "");

    // Candidate profile (entirely optional)
    ["candidateFullName", "candidateEmail", "candidatePhone", "candidateLinkedin",
      "candidatePortfolio", "candidateGithub", "candidateLocation", "candidateTargetRole",
      "candidateContext"].forEach(function (id) { setValue(id, ""); });

    // Opportunity (entirely optional, including the job description text)
    ["opportunityTargetRole", "opportunityJobDescription", "opportunityJobUrl",
      "opportunityRequiredSkills", "opportunityIndustry", "opportunityExperience",
      "opportunityHiringContext"].forEach(function (id) { setValue(id, ""); });
    appState.jobDescription.extractedText = "";
    appState.jobDescription.fileName = null;
    appState.jobDescription.fileSize = null;
    renderFileChip("jobDescription");
    el.jobDescStatus.hidden = true;

    // Preferences back to defaults
    el.preferencesObjective.value = "explore_opportunities";
    setValue("preferencesObjectiveCustom", "");
    el.preferencesTone.value = "professional_direct";
    setValue("preferencesToneCustom", "");
    setLength("standard");
    setValue("preferencesLanguage", "English");
    setValue("preferencesSignOff", "");
    setValue("preferencesAchievements", "");
    setValue("preferencesCallToAction", "");
    setValue("preferencesAvoidPhrases", "");
    byId("prefIncludeNetworking").checked = true;
    byId("prefIncludeReferral").checked = false;
    byId("prefIncludeShort").checked = false;

    // Research context
    ["researchRecipientProfile", "researchCompanyWebsite", "researchInitiatives",
      "researchDevelopments", "researchRelationship", "researchNotes"].forEach(function (id) { setValue(id, ""); });
    byId("researchMode").value = "provided_information_only";

    // Additional context
    ["additionalPrevious", "additionalMotivation", "additionalSellingPoint",
      "additionalResumeConcerns", "additionalInstructions"].forEach(function (id) { setValue(id, ""); });

    cleared.push("candidate profile", "target opportunity and job description", "outreach preferences (reset to defaults)",
      "research and personalization notes", "additional context");

    clearAllFieldErrors();
    updateCustomFieldVisibility();
    updateCharacterCounts();
    handleFormMutation();

    var message = "Cleared: " + cleared.join(", ") + ". Kept: the four required recipient fields, the resume text and imported file, and the master instructions.";
    setOutputStatusNotice(message);
    showToast(message, "success");
  }

  function setValue(id, value) {
    var node = byId(id);
    if (node) node.value = value;
  }

  function setLength(value) {
    var radios = document.querySelectorAll('input[name="preferencesLength"]');
    Array.prototype.slice.call(radios).forEach(function (radio) {
      radio.checked = radio.value === value;
    });
  }

  function setOutputStatusNotice(message) {
    if (!appState.hasGenerated) {
      el.outputStatusText.textContent = message;
    } else {
      el.outputStatusText.textContent = message + " The output above has been refreshed from the remaining inputs.";
    }
  }

  /* ======================================================================
     15. RESET
     ====================================================================== */

  function requestReset() {
    openConfirm({
      title: "Reset the entire form?",
      body: "This clears all recipient and candidate personal data, the resume text and imported file, the job description, research notes, preferences, and the generated output, and restores the default master instructions.\n\nThis cannot be undone.",
      confirmLabel: "Reset everything",
      destructive: true,
      onConfirm: resetForm
    });
  }

  function resetForm() {
    // Personal data
    [
      "recipientFullName", "recipientTitle", "recipientCompany", "recipientEmail",
      "recipientLinkedin", "recipientCompanyWebsite", "recipientTeam", "recipientBackground",
      "candidateFullName", "candidateEmail", "candidatePhone", "candidateLinkedin",
      "candidatePortfolio", "candidateGithub", "candidateLocation", "candidateTargetRole",
      "candidateContext", "resumeText", "opportunityTargetRole", "opportunityJobDescription",
      "opportunityJobUrl", "opportunityRequiredSkills", "opportunityIndustry",
      "opportunityExperience", "opportunityHiringContext", "preferencesObjectiveCustom",
      "preferencesToneCustom", "preferencesSignOff", "preferencesAchievements",
      "preferencesCallToAction", "preferencesAvoidPhrases", "researchRecipientProfile",
      "researchCompanyWebsite", "researchInitiatives", "researchDevelopments",
      "researchRelationship", "researchNotes", "additionalPrevious", "additionalMotivation",
      "additionalSellingPoint", "additionalResumeConcerns", "additionalInstructions"
    ].forEach(function (id) { setValue(id, ""); });

    // Master instructions back to defaults, locked and included
    el.instructionsText.value = DEFAULT_INSTRUCTIONS;
    el.instructionsText.readOnly = true;
    el.lockToggle.checked = true;
    el.includeInstructions.checked = true;
    el.lockStatusText.textContent = "Locked";
    appState.instructions.locked = true;
    appState.instructions.included = true;

    // Defaults for preferences and research mode
    el.preferencesObjective.value = "explore_opportunities";
    el.preferencesTone.value = "professional_direct";
    setLength("standard");
    setValue("preferencesLanguage", "English");
    byId("prefIncludeNetworking").checked = true;
    byId("prefIncludeReferral").checked = false;
    byId("prefIncludeShort").checked = false;
    byId("researchMode").value = "provided_information_only";
    el.resumeFile.value = "";
    el.jobDescFile.value = "";

    // Imported-file references
    appState.resume = { extractedText: "", fileName: null, fileSize: null };
    appState.jobDescription = { extractedText: "", fileName: null, fileSize: null };
    renderFileChip("resume");
    renderFileChip("jobDescription");
    el.resumeStatus.hidden = true;
    el.jobDescStatus.hidden = true;

    // Generated output and interface states
    appState.hasGenerated = false;
    appState.outputIsCurrent = false;
    appState.overLimit = false;
    appState.built = null;
    appState.validationRequested = false;
    appState.outputMode = "complete";
    el.outputText.value = "";
    el.outputWarn.hidden = true;
    expandAllCards();
    clearAllFieldErrors();
    setOutputMode("complete");

    updateCustomFieldVisibility();
    updateCharacterCounts();
    updateReadiness();
    renderOutput();

    showToast("Form reset. Default instructions restored and the output was cleared.", "success");
  }

  /* ======================================================================
     16. CONFIRMATION DIALOG
     ====================================================================== */

  function openConfirm(options) {
    appState.pendingAction = options.onConfirm;
    appState.lastFocused = document.activeElement;
    el.confirmTitle.textContent = options.title || "Are you sure?";
    el.confirmBody.textContent = options.body || "";
    el.confirmOkBtn.textContent = options.confirmLabel || "Confirm";
    el.confirmOkBtn.className = "btn " + (options.destructive ? "cr-btn-danger" : "cr-btn-primary");
    el.confirmBackdrop.hidden = false;
    el.confirmOkBtn.focus();
  }

  function closeConfirm() {
    el.confirmBackdrop.hidden = true;
    appState.pendingAction = null;
    if (appState.lastFocused && typeof appState.lastFocused.focus === "function") {
      appState.lastFocused.focus();
    }
  }

  function confirmPendingAction() {
    var action = appState.pendingAction;
    el.confirmBackdrop.hidden = true;
    appState.pendingAction = null;
    if (appState.lastFocused && typeof appState.lastFocused.focus === "function") {
      appState.lastFocused.focus();
    }
    if (typeof action === "function") action();
  }

  function cancelPendingAction() {
    closeConfirm();
  }

  function handleDialogKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelPendingAction();
      return;
    }
    if (event.key !== "Tab") return;
    // Simple focus trap across the two dialog buttons.
    var focusables = [el.confirmCancelBtn, el.confirmOkBtn];
    var index = focusables.indexOf(document.activeElement);
    event.preventDefault();
    var next = event.shiftKey
      ? focusables[(index <= 0 ? focusables.length : index) - 1]
      : focusables[(index + 1) % focusables.length];
    next.focus();
  }

  /* ======================================================================
     17. TOASTS
     ====================================================================== */

  var TOAST_ICONS = {
    success: "bi-check-circle",
    error: "bi-exclamation-octagon",
    info: "bi-info-circle"
  };

  function showToast(message, kind) {
    var type = kind || "info";
    var toast = document.createElement("div");
    toast.className = "cr-toast cr-toast-" + type;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    var icon = document.createElement("i");
    icon.className = "bi " + (TOAST_ICONS[type] || TOAST_ICONS.info);
    icon.setAttribute("aria-hidden", "true");

    var text = document.createElement("span");
    text.textContent = message; // textContent only: no HTML injection

    var close = document.createElement("button");
    close.type = "button";
    close.className = "cr-toast-close";
    close.setAttribute("aria-label", "Dismiss message");
    close.textContent = "\u00D7";
    close.addEventListener("click", function () {
      dismissToast(toast);
    });

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    el.toastRegion.appendChild(toast);

    // Keep the region from growing without bound during long sessions.
    while (el.toastRegion.children.length > 4) {
      el.toastRegion.removeChild(el.toastRegion.firstChild);
    }

    window.setTimeout(function () {
      dismissToast(toast);
    }, type === "error" ? 9000 : 5500);
    return toast;
  }

  function dismissToast(toast) {
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  }

  /* ======================================================================
     18. MISC UI
     ====================================================================== */

  function updateCustomFieldVisibility() {
    el.preferencesObjectiveCustomField.hidden = el.preferencesObjective.value !== "custom";
    el.preferencesToneCustomField.hidden = el.preferencesTone.value !== "custom";
  }

  /* ======================================================================
     19. BOOTSTRAP
     ====================================================================== */

  function init() {
    initializeApp();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed only for automated testing and debugging of pure functions.
  // No user data is exposed here; the reference is read-only by convention.
  window.ColdReach = {
    buildPluginInput: buildPluginInput,
    buildJson: function () { return buildJson(collectFormData()); },
    collectFormData: collectFormData,
    validateForm: function () { return validateForm(collectFormData()); },
    DEFAULT_INSTRUCTIONS: DEFAULT_INSTRUCTIONS,
    APP_CONFIG: APP_CONFIG
  };
})();
