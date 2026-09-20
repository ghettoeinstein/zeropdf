# PRD — ZeroGuide

Deterministic Local Document Assistant for ZeroPDF

**Version:** 1.0
**Status:** Founding implementation spec
**Product:** ZeroPDF
**Subsystem:** ZeroGuide
**Owner:** Caleb Saunders / `@ghettoeinstein`
**Execution model:** 100% local, deterministic, rule-based
**AI/LLM dependency:** None
**Network dependency:** None
**Primary purpose:** Continuously inspect the open document and recommend the safest, highest-value next actions without hallucination, remote inference, or opaque model behavior.

## 1. Product Thesis

ZeroGuide is not a chatbot. It is a deterministic document expert system. Its purpose is to answer: *What should I do next with this PDF, and why?* using only actual document state, verified ZeroPDF capabilities, explicit rules, deterministic scoring, local document analysis, and current user workflow state.

```text
DOCUMENT
   ↓
OBSERVE FACTS
   ↓
DERIVE STATE
   ↓
MATCH RULES
   ↓
RANK ACTIONS
   ↓
EXPLAIN
   ↓
USER APPROVES
   ↓
EXECUTE
   ↓
VERIFY
```

No prompts. No model. No probabilistic completion. No hallucination. No remote API.

## 2. Product Promise

ZeroGuide should feel intelligent because it actually understands the document structure and the current task. It must never pretend to know something it has not deterministically observed.

The assistant may say: "6 pages appear to be scanned and contain no extractable text." It may not say: "This looks like an important legal contract" — unless that classification comes from a separately implemented deterministic classifier with clear evidence. Its authority comes from facts and rules, not language generation.

## 3. Primary User Jobs

- **Guide** — What can I do with this document?
- **Finish** — What remains before this is ready?
- **Protect** — Is there anything I should remove before sharing?
- **Check** — Is anything unusual, unsupported, or risky in this PDF?

These four modes are views over the same underlying rule engine.

## 4. Product Principles

Deterministic, explainable, actionable, local, reversible when possible, honest (distinguishes observed fact / derived fact / warning / suggestion / unsupported capability), quiet (calm document inspector, not an engagement system).

## 5. Experience Concept

A collapsible contextual panel:

```text
┌─────────────────────────────────────┐
│ ZeroGuide                       ×   │
├─────────────────────────────────────┤
│ 3 things worth checking             │
│                                     │
│ ① Finish 7 form fields              │
│   7 required or empty fields remain │
│   [Review fields]                   │
│                                     │
│ ② Make 6 pages searchable           │
│   These pages contain images but    │
│   no extractable text.              │
│   [Run OCR]                         │
│                                     │
│ ③ Review document metadata          │
│   Author and application metadata   │
│   are embedded in this file.        │
│   [Inspect]                         │
└─────────────────────────────────────┘
```

Updates as document state changes. No chat interface required for v1.

## 6. Modes

**Guide** — capabilities relevant to the current document (e.g. "You can: Fill 12 form fields · Edit detected text · Search native text · Reorder 8 pages · Add signatures. OCR recommended on pages 5–8").

**Finish** — what prevents the document from being ready: incomplete form fields, pending edits, pending redaction marks, scan pages awaiting OCR, unresolved export warnings, pages awaiting normalization, unsaved changes.

**Protect** — sharing/privacy hygiene: remove metadata, flatten forms, apply pending redactions, remove attachments, remove embedded actions, clear hidden values, sanitize comments, verify redaction.

**Check** — unusual document properties: mixed page sizes, rotated pages, suspicious actions, embedded attachments, unusual fonts, unsupported annotations, XFA forms, encrypted content, image-only pages, very large dimensions, duplicate pages.

## 7. System Architecture

```text
PDF SOURCE → Document Inspector → DocumentFacts → DerivedContext
  → Rule Engine → Recommendation Set → Priority Resolver
  → ZeroGuide UI → Action Registry → ZeroPDF Commands
```

ZeroGuide must not directly mutate PDF state. It calls existing ZeroPDF actions.

## 8. Document Facts

```ts
interface DocumentFacts {
  pageCount: number;
  nativeTextPages: number;
  imageOnlyPages: number;
  searchablePages: number;
  formFieldCount: number;
  emptyFormFieldCount: number;
  requiredEmptyFieldCount: number;
  annotationCount: number;
  attachmentCount: number;
  metadata: {
    hasAuthor: boolean;
    hasCreator: boolean;
    hasProducer: boolean;
    hasTitle: boolean;
    hasSubject: boolean;
    hasKeywords: boolean;
  };
  interactive: {
    hasJavaScript: boolean;
    hasActions: boolean;
    hasXFA: boolean;
  };
  pages: {
    mixedSizes: boolean;
    rotatedCount: number;
    blankCandidates: number;
    duplicateCandidates: number;
  };
  edits: {
    addedMarks: number;
    textReplacements: number;
    pendingRedactions: number;
    unsavedChanges: boolean;
  };
  capabilities: {
    canEditText: boolean;
    canOCR: boolean;
    canRedact: boolean;
    canSanitize: boolean;
    canFlattenForms: boolean;
  };
  export: {
    hasWarnings: boolean;
    verificationStatus: "not-run" | "verified" | "verified-with-warnings" | "failed";
  };
}
```

This object becomes the single source of truth for ZeroGuide.

## 9. Derived Context

```ts
interface DerivedContext {
  needsOCR: boolean;
  hasIncompleteForm: boolean;
  shareRisk: boolean;
  hasPendingDestructiveActions: boolean;
  hasUnsupportedFeatures: boolean;
  likelyReadyToExport: boolean;
}
```

Derived values must be calculated from facts, e.g. `needsOCR = facts.imageOnlyPages > 0 && facts.searchablePages < facts.pageCount`. No hidden inference.

## 10. Recommendation Contract

```ts
interface GuideRecommendation {
  id: string;
  mode: "guide" | "finish" | "protect" | "check";
  priority: number;
  severity: "info" | "suggestion" | "warning" | "critical";
  title: string;
  reason: string;
  evidence: EvidenceRef[];
  action?: { id: string; label: string };
  reversible: boolean | "until-export";
  network: "none";
  dismissible: boolean;
  dedupeKey?: string;
}
```

Every recommendation must answer: Why? What will change? Can I undo it? Does anything leave my device?

## 11. Rule Engine

Rules are explicit data or functions, e.g.:

```ts
const rules: GuideRule[] = [
  {
    id: "ocr-image-only-pages",
    mode: ["guide", "finish"],
    when: ({ facts }) => facts.imageOnlyPages > 0,
    priority: ({ facts }) => Math.min(95, 60 + facts.imageOnlyPages),
    recommendation: ({ facts }) => ({
      title: "Make scanned pages searchable",
      reason: `${facts.imageOnlyPages} pages contain images but no extractable text.`,
      action: { id: "ocr.start", label: "Run OCR" },
      reversible: "until-export",
      network: "none",
    }),
  },
];
```

Rules should be unit-testable independently of React.

## 12. Priority Model

```text
90–100  blocked / critical
70–89   important before export
50–69   useful improvement
30–49   optional workflow improvement
0–29    informational
```

Modifiers: irreversibility, security/privacy issue, affected page count, required field state, export blocker, current user mode, current selection. Avoid excessively clever scoring — predictability matters more than sophistication.

## 13. Initial Rule Catalog

~20–30 high-quality rules, not hundreds of weak ones, across: document readiness (unsaved edits, pending redactions, incomplete required fields, empty form fields, failed export verification, export warnings), searchability (image-only pages, partial OCR, rotated scans), sharing/privacy (metadata, attachments, comments, interactive form values, embedded actions/JavaScript), document quality (mixed dimensions, rotated pages, blank/duplicate candidates), capability guidance (native text editable, visually-replaceable only, OCR available, unsupported forms/features).

## 14. Action Registry

```ts
interface ZeroAction {
  id: string;
  label: string;
  canRun(ctx: DocumentContext): boolean;
  execute(ctx: ActionContext): Promise<void>;
}
```

Examples: `ocr.start`, `forms.reviewIncomplete`, `metadata.inspect`, `sanitize.open`, `redaction.review`, `redaction.apply`, `export.open`, `page.reviewBlank`, `page.reviewRotations`, `search.open`. ZeroGuide does not implement these actions itself.

## 15. No Hallucination Contract

Every displayed statement is one of: **fact** ("7 form fields are empty" — derived directly from document structure), **rule conclusion** ("Consider reviewing these fields before export" — generated from explicit rule logic), or **capability statement** ("ZeroPDF can OCR these pages locally" — derived from the capability registry).

It must never say "This document is legally complete," "This signature is valid," "This document is safe," "This contract looks unusual," or "This PDF contains sensitive information" unless a deterministic rule specifically proves the narrower claim being made.

## 16. Explainability Drawer

Every recommendation supports "Why am I seeing this?":

```text
Make this searchable
WHY: Pages 4–9 contain raster images and no extractable PDF text.
WHAT CHANGES: ZeroPDF will run local OCR and add a searchable text layer.
UNDO: Yes, until export.
NETWORK: None.
```

## 17. Recommendation Lifecycle

`ACTIVE → DISMISSED / RESOLVED / STALE`. E.g. "7 incomplete fields" → user fills them → recommendation automatically becomes RESOLVED. Dismissal applies only to the current document/session unless explicit persistence is later introduced.

## 18. Event-Driven Recalculation

Do not rescan the whole PDF after every mouse movement. Rules recalculate when relevant state changes: `document.loaded`, `page.added/removed/reordered`, `form.changed`, `mark.added/removed`, `ocr.completed`, `redaction.marked/applied`, `metadata.changed`, `export.completed`, `verification.completed`. Each event invalidates specific fact domains.

## 19. Inspector Pipeline

```text
OPEN → FAST INSPECTION → Guide becomes useful immediately
     → DEEP INSPECTION → additional recommendations appear
```

Fast: page count, text availability, forms, basic metadata, page sizes, rotation. Deep: attachments, actions, annotations, duplicate detection, blank detection, scan properties, font anomalies. Do not block document opening on deep analysis.

## 20. UI Placement

Desktop: right-side contextual panel. Mobile: bottom sheet. Entry points: Guide / Check / Finish / Protect. Compact status button: "Guide · 3" when three relevant recommendations exist.

## 21. Empty State

"Looks good from here. ZeroGuide found no unfinished actions or warnings it knows how to detect." — the second sentence matters: not a guarantee the document is error-free.

## 22. Tone

Calm, specific, short, technical when useful, non-judgmental. Avoid "Great job!", "I think...", "AI suggests...", "You should definitely...", "Your document is perfect!". Prefer "3 fields remain empty.", "Pages 5–8 are not searchable.", "This file contains author metadata.", "Export verification failed."

## 23. Privacy

Inherits the ZeroPDF privacy constitution: no network requests, no remote state, no document facts sent externally, no LLM, no analytics containing document-derived facts. The panel can explicitly say "Deterministic · Local · No AI."

## 24. Performance

Initial recommendations <500ms after document analysis is available; rule evaluation <16ms for ordinary state updates; no main-thread deep scans; deep analysis in workers where appropriate.

## 25. Testing

Rule tests (facts → expected recommendation), negative tests (rules don't fire without evidence), priority tests (same state → same ordering), action integration tests, privacy test (zero workload network requests), regression tests (e.g. scan→OCR recommendation appears then disappears after OCR completes; incomplete forms→recommendation disappears once filled; metadata present→recommendation disappears once removed).

## 26. Golden Workflow

Fixture: 12-page PDF, 3 native-text pages, 4 scan pages, 5 form fields, 2 empty fields, metadata present, 1 attachment.

Initial: `Finish 2 form fields · Make 4 pages searchable · Review metadata · Review 1 attachment`. After filling fields, OCR, and Share Safe respectively, each resolves in order until: "No outstanding recommendations." Fully deterministic.

## 27. Advanced Phase — Recipes

Compose actions into workflows, e.g. "Prepare to Share": inspect metadata → remove metadata → flatten forms → apply verified redactions → sanitize actions → verify output. The assistant describes the recipe before running it. No hidden actions.

## 28. Advanced Phase — Local Macros

Deterministic automation, e.g. "WHEN document has metadata THEN suggest Share Safe", or user-defined sequences like OCR → flatten forms → strip metadata → verify → export. Still no LLM required.

## 29. Suite-Level Expansion

ZeroGuide should eventually become ZeroGuide Core across ZeroTools: ZeroCompress ("At the current bitrate this file is unlikely to reach 25 MB."), ZeroEXIF ("This image contains GPS coordinates."), ZeroEncrypt ("This file has not been encrypted yet."), ZeroData ("14 rows contain a different number of columns."). Same architecture: Facts → Rules → Actions → Explanations.

## 30. Architecture Boundary

Do not couple the rules engine to PDF.js or React: `PDF adapters → DocumentFacts → ZeroGuide Core → Recommendations → UI adapters`. This allows reuse across ZeroTools.

## 31. File Structure

```text
src/
  guide/
    facts/collectDocumentFacts.ts, deriveContext.ts
    rules/forms.rules.ts, ocr.rules.ts, sharing.rules.ts, export.rules.ts, structure.rules.ts
    actions/actionRegistry.ts
    engine/evaluateRules.ts, rankRecommendations.ts, recommendationTypes.ts
    ui/GuidePanel.tsx, RecommendationCard.tsx, ExplanationDrawer.tsx
```

Later move generic portions into `packages/guide/` only after another ZeroTool proves reuse.

## 32. Definition of Done — V1

Facts derive exclusively from local document state; recommendations are deterministic; no LLM/network dependency; ≥20 useful rules; every recommendation explains why; actions connect to real workflows; resolved issues disappear automatically; dismiss works; desktop and mobile UI exist; rule engine has comprehensive unit tests; privacy regression passes; recommendation order is deterministic; performance remains responsive.

## 33. Product Success

ZeroGuide succeeds when the user stops needing to understand PDF internals (OCR, AcroForms, metadata, annotations, content streams, flattening, sanitation) and instead sees outcomes: Finish this / Make this searchable / Share this safely / Check this document.

## 34. North-Star Statement

ZeroGuide knows what ZeroPDF knows, recommends only what ZeroPDF can prove, and never pretends to know more. Suggested subtle UI copy: "Local deterministic assistant · No AI · No document uploads."

---

## Implementation note (added at intake, 2026-09-20)

This spec is the full, multi-milestone version of ZeroGuide. It should **not** be built in one pass. In particular:

- §11/§13 (a full rule engine with 20–30 rules) and §14 (an action registry wired to real commands like `ocr.start`, `metadata.inspect`, `sanitize.open`) depend on capabilities ZeroPDF does not have yet (OCR, metadata inspection/removal, Share Safe, verified redaction). Do not ship a rule or action button that points at a capability that doesn't exist — that is exactly the hallucination this system exists to prevent (§15).
- The correct sequencing is: ship a small, honest **read-only** "Check"-mode slice first (real facts, real informational recommendations, no fake action buttons), then add real `action`s to existing recommendations only as each underlying feature (OCR, Share Safe, redaction) actually ships.
- See `PRODUCT_ROADMAP.md` for how this fits the broader sequence, and `AGENTS.md` for the current build target.
