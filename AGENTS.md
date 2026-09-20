# AGENTS.md — ZeroPDF

Doctrine lives one level up at `../AGENTS.md` (ZeroTools root). Read that first. This file only tracks ZeroPDF's current build target.

## Current stage

Stage A — Stabilize ZeroPDF (root AGENTS.md §32), before touching OCR, redaction, or the text-edit engine.

## Done

* ZP-001 — fixed the `PdfCanvas` stale-render race via a generation guard in `src/components/PageView.tsx`. See `BUILD-LOG.md`.

## Next up

* ZP-002 — flip `useWasm: true` in `src/pdf/engine.ts`, self-host PDF.js's WASM assets so nothing loads from a third-party CDN during document processing.
* ZP-003 — render/export worker split + generation coordinator (builds on ZP-001).

## Explicitly not touching yet

* Existing-text inline editing (Native/Replace/Visual modes) — gated, needs disclosure UI decided first (see root AGENTS.md §24, §35 equivalents for redaction/claims honesty).
* Verified redaction / Verification Engine.
* Repo restructuring — this repo stays a normal Vite/React app; do not introduce `apps/`/`packages/` nesting here.

## Where things are

* `src/components/PageView.tsx` — canvas render + annotation/text overlay.
* `src/pdf/engine.ts` — PDF.js load + pdf-lib export.
* `src/state/model.ts` — Mark/Page/Snapshot types, undo/redo.
* `BUILD-LOG.md` — slice-by-slice change log, append one line per completed slice.
