# ZeroPDF Product Roadmap — Beyond Feature Parity

Captured from a product-direction discussion on 2026-09-20, after the
existing-text click-to-edit feature shipped. The thesis: don't just
recreate Acrobat's toolbar — build a product that understands the
document, tells the user what it can safely do, does the work locally,
and proves the result. Each item below should be judged against that
bar, and against the non-negotiables in `../AGENTS.md` (no claim ZeroPDF
can't back with actual verification, no "secure redaction" that isn't).

## Chosen sequence

```
existing-text edit (done)
  -> Document Doctor
  -> Search/action
  -> Share Safe
  -> Verified redaction
  -> Privacy receipt
  -> Version compare
  -> Local recipes/macros
```

## The full list

1. **Share Safe mode** — one action that locally strips metadata,
   comments, attachments, hidden form values, suspicious actions,
   optional OCR text, then exports a sanitized copy. Copy: "Make a
   copy you'd be comfortable forwarding." Replaces six obscure cleanup
   toggles with one outcome.
2. **Privacy Receipt** — after export, a local report: 0 B uploaded,
   metadata removed, forms flattened/preserved, redactions verified,
   page count checked, output reopened successfully. Makes the
   privacy architecture visible as product value, not just a claim.
3. **Document Doctor** — inspect a PDF and explain what's unusual:
   embedded fonts, weird page sizes, forms, annotations, scans,
   JavaScript/actions, attachments, unsupported encodings, damaged
   objects — then say what ZeroPDF can safely do about each.
4. **"What changed?" export summary** — human-readable local diff
   after editing: "2 pages reordered · 1 text replacement · 3 form
   fields changed · 1 signature added · metadata preserved."
5. **Local version compare** — drop two PDFs, highlight changed
   text/regions/pages, entirely in-browser.
6. **Intent recipes instead of tools** — Sign & Return, Prepare for
   Email, Make Searchable, Share Safely, Print Clean, Archive Copy.
   Each composes lower-level features; users think in outcomes.
7. **Search → action** — local search that highlights all, replaces
   all, redacts all, or jumps matches. Includes "find sensitive
   patterns" (emails, phone numbers, account-like numbers via local
   regex) with review before redacting.
8. **Redaction Proof Mode** — after redaction, ZeroPDF actively tries
   to recover the removed content through its own parser/search/
   extraction paths. If it still can, export fails verification.
   UI: "We tried to recover it. We couldn't."
9. **Background-aware text replacement** — extend the existing canvas
   color sampling to classify the patch area as flat color, gradient,
   image, or complex texture, and label the edit accordingly: clean
   replacement, approximate replacement, or visual replacement only.
10. **Session Fill Memory** — while the tab is open, offer a value
    filled in one form field ("Name: Caleb Saunders") for another
    matching field. No account, no cloud profile, no hidden
    persistence — explicitly session-scoped.
11. **Local macros** — record a short sequence ("rotate all landscape
    pages -> add footer -> flatten forms -> strip metadata") and
    replay it on another document.
12. **Document Time Machine** — optional local snapshots (Opened,
    Filled forms, Before signature, Before page reorder, Exported)
    to jump back to. If persisted via OPFS later, must be opt-in
    per root AGENTS.md §10.
13. **Scan Rescue** — auto-detect rotated/poor scans, deskew, rotate,
    crop borders, improve contrast, OCR, rebuild searchable pages.
    Packaged as "Fix this scan," not seven image settings.
14. **Page intelligence** — auto-identify blank pages, duplicates,
    likely covers, orientation changes, unusually large pages, scans
    vs. native text. Surface actions: "3 blank pages found — review?"
15. **Smart merge** — visual staging table before merge: page counts,
    orientation, duplicates, form presence, filenames, size. "Combine
    cleanly" with optional normalization.
16. **Local command palette** (Cmd-K) — "rotate page," "strip
    metadata," "redact," "export," "find invoice," etc.
17. **Capability Inspector** — a small technical panel: native text
    extraction, forms, OCR-needed pages, embedded font count, direct
    text replacement support, safe redaction support (with raster
    fallback noted).
18. **Offline mode badge with evidence** — not just "local": `LOCAL ·
    0 B UPLOADED · NETWORK BLOCKED`, click to see why/how.
19. **"Open somewhere else" compatibility check** — before download,
    reopen locally and report: parse OK, page count, forms preserved,
    no unsupported features introduced. Eventually add fixture testing
    against Preview/Acrobat in CI (the app itself stays local-first).
20. **One-click "Clean copy"** — flatten weird structures, normalize
    rotations, remove unsupported interactivity, rebuild a simpler
    PDF, and disclose exactly what was discarded.

## Ground rules carried over from `../AGENTS.md`

- Every "verified" or "safe" claim must be backed by an actual
  re-open-and-check pass (§24), not just "the button ran."
- Cover/visual-replace and true removal are always distinguished in
  the UI, never blurred (already established by the text-edit
  feature's disclosure toast — extend that pattern, don't dilute it).
- No feature here re-introduces network dependency or silent
  persistence; Session Fill Memory and Document Time Machine are
  explicitly in-memory/opt-in only until a real product need for
  persistence is demonstrated.
