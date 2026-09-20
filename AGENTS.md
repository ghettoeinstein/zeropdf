# AGENTS.md — ZeroPDF

Doctrine lives one level up at `../AGENTS.md` (ZeroTools root). Read that first. This file only tracks ZeroPDF's current build target.

## Current stage

Stage A — Stabilize ZeroPDF (root AGENTS.md §32), before touching OCR, redaction, or the text-edit engine.

## Done

* ZP-001 — fixed the `PdfCanvas` stale-render race via a generation guard in `src/components/PageView.tsx`.
* Existing-text click-to-edit (Visual replace mode only — see `src/pdf/textBlocks.ts`, `src/components/PageView.tsx`). Every edit discloses font substitution and that the original may still be recoverable. Auto-selects on commit so it can be dragged/resized immediately.
* Welcome-screen redesign toward editorial/utility, away from generic SaaS (see `docs/PRODUCT_ROADMAP.md` for the critique that drove it).
* ZeroGuide V0 — a real, honest "Document check" (`src/guide/facts.ts`, `src/guide/rules.ts`). Read-only, no action buttons yet. Full spec at `docs/PRD_ZEROGUIDE.md`.
* Fixed a real production-only bug: GitHub Pages was serving unbuilt source, gated behind a broken mobile a11y test (icon-only button with no accessible name). Both fixed; CI now actually deploys `dist/`.

## Next up

Per `docs/PRODUCT_ROADMAP.md`'s chosen sequence, in order:

* Search/action (local search → highlight/replace/redact matches).
* Share Safe (one-action metadata/attachment/action strip + export).
* Verified redaction (Redaction Proof Mode — see PRD §8-equivalent in the roadmap).
* Privacy Receipt.
* Version compare.
* Local recipes/macros.
* Wire real `action`s onto existing ZeroGuide rules **only** as each of the above actually ships — never before (see PRD_ZEROGUIDE.md's "Implementation note").
* ZP-002 — flip `useWasm: true` in `src/pdf/engine.ts`, self-host PDF.js's WASM assets.
* ZP-003 — render/export worker split + generation coordinator.

## Explicitly not touching yet

* Native (font-preserving) or Replace (disclosed-substitution-but-content-stream) text edit modes — only Visual replace is implemented. See PRD_ZEROGUIDE.md and PRODUCT_ROADMAP.md item 9 (background-aware classification) before extending this.
* OCR, metadata removal, redaction, version compare, macros — none exist yet; don't let ZeroGuide's rules imply they do.
* Repo restructuring — this repo stays a normal Vite/React app; do not introduce `apps/`/`packages/` nesting here.

## Where things are

* `src/components/PageView.tsx` — canvas render, annotation overlay, and the click-to-edit text layer.
* `src/pdf/textBlocks.ts` — extracts/merges PDF.js text runs into editable line blocks.
* `src/pdf/engine.ts` — PDF.js load + pdf-lib export (including the patchColor backing-rect for edited text).
* `src/state/model.ts` — Mark/Page/Snapshot/Source types, undo/redo.
* `src/guide/` — ZeroGuide: `facts.ts` (deterministic observations), `rules.ts` (fact → recommendation).
* `docs/PRD_ZEROGUIDE.md`, `docs/PRODUCT_ROADMAP.md` — the founding specs; read before extending either area.
* `BUILD-LOG.md` — slice-by-slice change log, append one line per completed slice.
