# ZeroPDF

**Your PDF never leaves your device.**

A static, browser-based PDF workspace built with React, TypeScript, PDF.js, and pdf-lib. Open a file, change what you need, and download it again. No accounts, backend, document uploads, tracking, or artificial page limits.

## Run locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. A built-in practice PDF lets you try the editor without choosing a personal document.

## Available in this initial implementation

- File picker and drag-and-drop import; multi-page viewer with lazy rendering, zoom, fit width/page, and thumbnails.
- Added text using Helvetica, Times Roman, or Courier, with size, color, alignment, and line spacing.
- Freehand ink, highlighting, rectangles, ellipses, lines, arrows, and **whiteout**.
- Drawn, typed, and uploaded signatures; PNG and JPEG placement.
- Selection, dragging, resizing, duplication, layer ordering, and keyboard nudging.
- Supported AcroForm text, checkbox, radio, dropdown, and list fields.
- Rotate, reorder (drag or buttons), delete, duplicate, append, insert, and extract pages.
- Undo/redo and local PDF download; editable output filename and form flattening.
- Responsive desktop/mobile workspace, local privacy explanation, and keyboard shortcuts.

## Important boundaries

This is **v0.1**, an initial implementation of the founding PRD, not a certified v1 release.

- **Whiteout is not secure redaction.** It covers content; it does not erase the original information.
- Click existing PDF text to replace it in place. This is a visual replacement (cover + redraw in a substituted font), not a content-stream edit — the covered original may still be recoverable from the exported file. ZeroPDF discloses this at the moment you edit.
- Encrypted PDFs must first be saved as an unencrypted copy in another trusted PDF reader. We do not bypass encryption.
- Reordering, merging, duplicating, deleting, inserting, or extracting pages automatically flattens form fields before copying pages. Standard export without page structure changes can retain supported interactive forms.
- Built-in text fonts support their standard Latin character repertoire. Unsupported text produces an export error while preserving your session. Uploaded text images are an alternative.
- A typed signature uses the bundled Caveat font. Signatures are visual marks, not cryptographic signatures or identity verification.
- PDF annotations created by other tools, XFA forms, rich form formatting, unusual font encodings, PDF portfolios, bookmarks after page organization, and every PDF variant are not guaranteed to round-trip.
- Documents, edits, and signatures stay in runtime memory. Refreshing or closing discards the session. Download first. Offline installation and crash recovery are not implemented.
- Large scans can exceed device memory. Rendering is lazy, but parsing and export still require document bytes in memory. Export runs on the main thread with progress updates between pages.
- Chromium workflows are automated. Full Firefox, Safari, Edge, macOS Preview, and Adobe Reader acceptance remains a release gate.

## Check the project

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

The production build is in `dist/`. End-to-end tests run against that build, open and export real PDFs, verify supported form values and page operations, and monitor requests during editing. Test files are generated; no personal PDFs are included.

```sh
npm run preview
```

## GitHub

Create an **empty** GitHub repository, then connect this project:

```sh
git remote add origin https://github.com/YOUR-ACCOUNT/zeropdf.git
git push -u origin main
```

CI checks the production build, unit tests, and Chromium workflows on pushes and pull requests. Dependabot checks npm and GitHub Actions updates weekly.

### GitHub Pages

1. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
2. Run the **Deploy to GitHub Pages** workflow, or push to `main` after enabling Pages.
3. The workflow builds and deploys `dist/`. Relative asset paths support project subdirectories.

For other static hosts, use `npm ci && npm run build` and publish `dist/`. The included `_headers` file adds production security headers on hosts that support that convention, such as Cloudflare Pages. GitHub Pages uses the HTML CSP but does not apply `_headers`.

## Privacy and security

Read [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md). The production CSP sets `connect-src 'none'`. Scripts, the PDF worker, and the signature font are served as local app assets. Development permits same-origin connections for Vite. There are no remote fonts, analytics, document APIs, or automatically followed PDF links.

## Project layout

```text
src/
  App.tsx                 Workspace, tools, page actions, import/export flow
  components/             Page renderer, annotation surface, dialogs, signatures
  pdf/engine.ts           PDF parsing, supported forms, export, practice PDF
  state/model.ts          Document-space model and undo/redo helpers
  style.css               Responsive workspace design
 tests/                   Real browser workflows
 .github/workflows/       CI and static deployment
```

## License

A license has **not yet been selected**. Do not assume that public hosting grants reuse rights. The founding PRD intentionally leaves the choice between a permissive and copyleft license to the project owner.
