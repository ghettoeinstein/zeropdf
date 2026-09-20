I’d tighten the product around one promise: **“Your PDF never leaves your device.”** I’d also narrow a few technically risky claims so v1 is actually shippable on static hosting.

The biggest corrections are: separate **whiteout** from **secure redaction**, remove arbitrary URL loading from the default zero-network mode, treat editing existing PDF text as a later capability, and make the export/performance requirements dependent on document complexity rather than promising `<2s` universally.

Here’s the refined PRD:

# ZeroPDF

## Local-First, Free-Forever PDF Editor

**Document Type:** Product Requirements Document
**Version:** 1.0
**Status:** Founding Product Specification
**Working Title:** ZeroPDF
**Product Class:** Static, client-side document utility

---

# 1. Executive Summary

**ZeroPDF** is a privacy-first PDF utility that allows a user to open, fill, annotate, sign, organize, modify, and export PDF documents entirely inside their web browser.

ZeroPDF has:

* No application backend
* No document upload server
* No user accounts
* No database
* No API keys
* No telemetry
* No subscription
* No artificial document limits

The user's browser performs the work.

PDF files are loaded into local browser memory, rendered locally, modified locally, and exported directly back to the user's device.

The core product promise is:

> **Your PDF never leaves your device.**

ZeroPDF should feel closer to opening a native utility than visiting a SaaS application.

The initial application can be distributed as static assets through GitHub Pages, Cloudflare Pages, or another static host.

---

# 2. Product Thesis

PDF editing has become unnecessarily cloud-dependent.

A user attempting something simple—signing a lease, filling out a form, rearranging pages, adding text, or combining two PDFs—is frequently pushed through:

* Account creation
* Upload screens
* File-size restrictions
* Daily quotas
* Trial funnels
* Subscriptions
* Watermarks
* Remote document processing

For sensitive documents, this architecture also creates unnecessary privacy exposure.

Modern browsers are capable of handling a large portion of these operations locally.

ZeroPDF exists to prove that the browser itself can be the document-processing environment.

### Product Equation

```text
PDF.js
+
pdf-lib
+
Canvas / DOM overlays
+
Browser File APIs
+
Static hosting
=
A useful PDF workstation with effectively zero server infrastructure
```

---

# 3. Product Principles

Every product decision should follow six principles.

## 3.1 Local First

Documents are processed locally whenever technically possible.

The server delivers application code—not user documents.

---

## 3.2 No Account Required

The primary workflow must never require:

* Registration
* Login
* Email
* Social authentication
* Payment details

Open → Edit → Download.

---

## 3.3 Free Without Artificial Limits

ZeroPDF should not impose artificial product restrictions such as:

* Two documents per day
* Five-page limits
* Watermarks
* Export locks
* Forced account creation
* Premium-only signatures

Actual browser memory and device capability may impose practical limits.

---

## 3.4 Privacy Must Be Observable

Privacy should not exist only in marketing copy.

The architecture itself should make the promise believable.

The product should prominently communicate:

**Processed locally. Never uploaded.**

A technical privacy page should explain how the system works.

---

## 3.5 Instant Utility

A first-time visitor should be able to edit a document without reading instructions.

Target workflow:

```text
Drop PDF
   ↓
Edit
   ↓
Download
```

---

## 3.6 Graceful Simplicity

ZeroPDF does not need to recreate every feature of Adobe Acrobat.

The objective is to solve the common PDF jobs extremely well.

---

# 4. Primary Jobs To Be Done

ZeroPDF should initially optimize for these user intents:

### Sign

> "Someone emailed me a document. I need to sign it and send it back."

### Fill

> "I received a PDF form and need to complete it."

### Add Text

> "This PDF isn't a real form, but I need to type information onto it."

### Annotate

> "I need to highlight, mark, draw, or comment on this document."

### Organize

> "I need to remove, rotate, reorder, extract, or combine pages."

### Add Images

> "I need to add a stamp, logo, initials, or image."

### Export

> "I need a normal PDF that works everywhere."

---

# 5. Explicit Non-Goals for v1

ZeroPDF v1 is **not** intended to be:

* A full Adobe Acrobat replacement
* A cloud document storage system
* A collaborative document editor
* A document management system
* An OCR platform
* A PDF-to-Word conversion engine
* An electronic-signature identity-verification platform
* A certificate-authority-based digital signing service
* A real-time collaborative editor
* A document sharing platform

Most importantly:

## Existing PDF Text Editing Is Not a v1 Requirement

PDFs are final-layout documents rather than semantic word-processing documents.

Reliably locating an existing sentence and editing it while preserving its exact font, spacing, wrapping, encoding, and surrounding content is significantly more difficult than adding new content.

ZeroPDF v1 therefore supports:

```text
Insert text
Cover existing content
Place replacement text
```

rather than promising universal direct modification of existing PDF text streams.

True existing-text editing can be investigated after v1.

---

# 6. Core User Experience

## 6.1 Empty State

The application opens to a minimal document workspace.

Primary CTA:

**Open PDF**

Secondary interaction:

**Drop a PDF anywhere**

Supporting message:

**Files stay on your device. Nothing is uploaded.**

No marketing funnel should stand between the user and the editor.

---

# 7. Application Layout

## Desktop

```text
┌─────────────────────────────────────────────────────────────┐
│ ZeroPDF    filename.pdf       3 / 12      -  Fit  +   SAVE │
├────────┬────────────────────────────────────────────────────┤
│        │                                                    │
│ PAGE   │                 Document Canvas                    │
│        │                                                    │
│  [1]   │                ┌───────────────┐                   │
│  [2]   │                │               │                   │
│  [3]   │                │      PDF      │                   │
│        │                │               │                   │
│        │                └───────────────┘                   │
│        │                                                    │
├────────┴────────────────────────────────────────────────────┤
│ Select  Text  Draw  Highlight  Sign  Shape  Image  Mask    │
└─────────────────────────────────────────────────────────────┘
```

---

# 8. Functional Requirements

# 8.1 File Import

Users must be able to import PDF files through:

### File Picker

```html
<input type="file" accept="application/pdf">
```

### Drag and Drop

Dropping a PDF anywhere over the document workspace should open it.

### Secondary PDF Import

Users may select an additional PDF for:

* Merge
* Append
* Insert pages

### Clipboard / Share Sheet

Future browser capabilities may support additional ingestion methods.

---

# 9. Network Policy

ZeroPDF's primary mode is deliberately network-isolated after initial application loading.

Therefore arbitrary URL-based document loading is **not a core v1 workflow**.

Supporting arbitrary URLs would require outbound browser requests and would weaken the simplicity of the:

> Nothing leaves your device.

security model.

URL import may later exist as an explicit optional action with clear disclosure.

---

# 10. Rendering Engine

Use **PDF.js** for document parsing and rendering.

Each visible page is rendered onto a high-resolution canvas.

The renderer must support:

* Progressive rendering
* Retina/high-DPI displays
* Zooming
* Page rotation
* Continuous scrolling
* Lazy page rendering
* Render cancellation
* Thumbnail generation

Pages outside the active viewport should not continuously consume rendering resources.

---

# 11. Document Model

The application should maintain two separate concepts:

```text
Original PDF
+
Editing State
```

Editing state should not immediately rewrite the binary document after every user interaction.

Example:

```ts
DocumentState {
  sourceBytes
  pages
  pageOrder
  pageRotations
  annotations
  formChanges
  insertedImages
  signatures
}
```

Export converts this application state into final PDF bytes.

This architecture enables:

* Undo
* Redo
* Faster interactions
* Non-destructive editing
* Reliable state management

---

# 12. Coordinate System

PDF coordinates and browser coordinates differ.

The editor must implement a canonical transformation layer:

```text
Screen Coordinates
      ↓
Viewport Coordinates
      ↓
PDF Page Coordinates
```

All annotation objects should store normalized document-space coordinates rather than raw screen pixels.

Example:

```ts
Annotation {
  pageId
  type
  x
  y
  width
  height
  rotation
  style
}
```

This prevents annotations from moving when the user changes zoom levels.

---

# 13. Selection Engine

All editable objects require a consistent selection system.

Selected items should expose:

* Bounding box
* Resize handles
* Drag behavior
* Delete action
* Duplicate action
* Layer ordering where relevant

Keyboard support:

```text
Delete / Backspace → Remove
Cmd/Ctrl + Z       → Undo
Cmd/Ctrl + Shift+Z → Redo
Cmd/Ctrl + C       → Copy supported object
Cmd/Ctrl + V       → Paste
Arrow Keys         → Nudge
Esc                → Deselect
```

---

# 14. Text Tool

Users can click anywhere on the page and insert text.

Supported properties:

* Text
* Font family
* Font size
* Color
* Alignment
* Line spacing
* Bounding-box width
* Rotation

Initial fonts:

* Helvetica
* Times Roman
* Courier

Future versions may support custom embedded fonts.

Text is displayed through an editable browser overlay during composition.

During export it is translated into PDF drawing operations.

---

# 15. Forms

When a PDF contains supported AcroForm fields, ZeroPDF should detect them.

Supported field types:

* Text fields
* Checkboxes
* Radio buttons
* Dropdowns
* Option lists

User workflow:

```text
Open PDF
 ↓
Detect Fields
 ↓
Highlight Interactive Fields
 ↓
Edit
 ↓
Export
```

Users should be able to choose between:

### Preserve Forms

Keep compatible fields interactive.

### Flatten Forms

Convert completed form appearances into non-editable page content where supported.

---

# 16. Signature System

The signature feature should support three creation modes.

## Draw

Pointer or touch signature pad.

Features:

* Smooth strokes
* Clear
* Undo stroke
* Stroke width
* Optional smoothing

---

## Type

User types their name and selects from a small collection of locally bundled signature-style fonts.

No font should require a remote request.

---

## Upload

Users can select:

* PNG
* JPEG

Transparent PNG should be preferred.

---

## Signature Privacy

Signatures should exist only in runtime memory by default.

Optional browser-local persistence may be considered later, but should require explicit consent.

No signature is uploaded to ZeroPDF infrastructure.

---

# 17. Freehand Drawing

Supported modes:

### Pen

Opaque freehand drawing.

### Highlighter

Semi-transparent drawing.

Each path stores:

```text
Page
Points
Stroke width
Color
Opacity
```

Pointer events should be sampled and simplified to reduce excessive PDF output size.

---

# 18. Shapes

v1 shapes:

* Rectangle
* Ellipse
* Line
* Arrow

Properties:

* Stroke color
* Fill color
* Stroke width
* Opacity

---

# 19. Image Placement

Supported image formats:

* PNG
* JPEG

Users can:

* Insert
* Resize
* Move
* Rotate
* Delete
* Duplicate

Images are embedded directly into the resulting PDF.

---

# 20. Whiteout vs Redaction

These must be treated as two separate concepts.

## Whiteout / Visual Mask

A white rectangle is drawn over existing content.

This visually hides information but **does not remove the underlying information from the original PDF content stream**.

The UI must not call this secure redaction.

Name:

**Whiteout**

or

**Cover**

---

## Secure Redaction

True redaction requires ensuring the underlying sensitive information cannot subsequently be recovered.

This is substantially more complex.

Secure redaction is therefore:

**Out of scope for v1 unless independently verified.**

The application must never represent an opaque rectangle as secure redaction.

---

# 21. Page Management

The page sidebar should support:

### Reorder

Drag thumbnails.

### Rotate

* 90°
* 180°
* 270°

### Delete

Remove page from output document.

### Duplicate

Copy page.

### Merge

Import pages from another PDF.

### Extract

Export selected pages into a new PDF.

### Insert

Add imported pages at a selected location.

---

# 22. Thumbnail Rail

Each thumbnail should show:

```text
┌─────────────┐
│             │
│ Page Image  │
│             │
├─────────────┤
│ 3   ↻   ⋮   │
└─────────────┘
```

Operations should remain discoverable without cluttering the document itself.

---

# 23. Undo / Redo

All editing operations should be represented as commands.

Example:

```text
AddTextCommand
MoveAnnotationCommand
DeletePageCommand
RotatePageCommand
AddSignatureCommand
ReorderPageCommand
```

Maintain undo and redo stacks.

Document binary regeneration should not occur when undoing individual UI operations.

---

# 24. Export Engine

When a user selects:

**Download PDF**

ZeroPDF:

1. Reads original source bytes.
2. Creates the output document.
3. Applies page operations.
4. Applies form changes.
5. Embeds required fonts.
6. Embeds images.
7. Converts annotations into PDF operations.
8. Applies flattening preferences.
9. Serializes the PDF.
10. Creates a local Blob.
11. Creates an object URL.
12. Triggers a browser download.
13. Releases temporary resources.

No output bytes should be transmitted to a server.

---

# 25. Export Modes

## Standard

Preserves supported interactive form fields.

## Flattened

Converts supported form fields into fixed output where possible.

Annotations created through ZeroPDF are written directly into document page content during export and therefore do not depend on ZeroPDF to render later.

---

# 26. Save Naming

Default output:

```text
originalname-edited.pdf
```

Examples:

```text
lease-edited.pdf
w9-signed.pdf
application-filled.pdf
```

The user may edit the output filename before saving.

---

# 27. Privacy Architecture

ZeroPDF must contain:

* No analytics
* No telemetry
* No advertising trackers
* No remote error-reporting SDK
* No third-party document-processing API
* No document storage
* No authentication service

Avoid:

* Google Analytics
* Mixpanel
* Segment
* PostHog
* Hotjar
* Sentry cloud
* Remote fonts

---

# 28. Content Security

Production builds should enforce a restrictive Content Security Policy appropriate for the final bundle architecture.

Example conceptual policy:

```text
default-src 'self';
connect-src 'none';
img-src 'self' blob: data:;
font-src 'self' data:;
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
```

The final policy must be tested against:

* PDF.js workers
* WebAssembly if introduced
* Blob URLs
* Local images
* Bundled fonts

Avoid relying on broad:

```text
'unsafe-inline'
```

permissions where possible.

---

# 29. Hosting Considerations

ZeroPDF can run on:

### GitHub Pages

Excellent for:

* Free static hosting
* Open-source distribution
* Automatic deployment
* Custom domains

However, GitHub Pages provides less control over HTTP response security headers.

### Cloudflare Pages

Potentially preferable for production deployment if stronger control over response headers is desired while retaining a static architecture.

The application itself remains backend-free either way.

---

# 30. Offline Capability

After v1 stability, ZeroPDF should become installable as a Progressive Web App.

A service worker can cache:

* HTML
* JavaScript
* CSS
* PDF.js worker
* Fonts
* Icons

Result:

```text
Visit Once
   ↓
Install / Cache
   ↓
Use Without Internet
```

This strengthens the local-first product proposition.

---

# 31. Memory Safety

PDF processing can consume substantial browser memory.

The editor should:

* Lazy-render pages
* Destroy unused canvas contexts
* Revoke stale Blob URLs
* Release imported image buffers
* Avoid retaining duplicate document copies
* Warn when device memory appears constrained

A 300-page scanned PDF and a 10-page text PDF have radically different resource requirements.

ZeroPDF should not promise unlimited document sizes.

---

# 32. Performance Requirements

Performance requirements should use realistic percentile targets rather than a universal export promise.

Target reference device:

Recent consumer laptop with 8 GB+ RAM.

### Application

Cold application shell:

**Target <2 seconds on broadband**

### Rendering

First visible page:

**Target <1 second after document parsing for typical documents**

### UI

Pointer interactions:

**Target 60 FPS**

### Annotation Response

Visible response:

**<100 ms perceived latency**

### Export

Typical:

* 20 pages
* Mostly text/vector
* Fewer than 50 annotations

**Target <3 seconds**

Large scanned/image-heavy PDFs may require significantly longer.

The interface should show progress rather than appearing frozen.

---

# 33. Worker Architecture

CPU-heavy PDF operations should eventually move into Web Workers when practical.

```text
Main UI Thread
     │
     ├──── Rendering UI
     ├──── Pointer Events
     └──── State
              │
              ▼
        PDF Worker
              │
              ├── Parse
              ├── Generate
              └── Export
```

Objective:

Prevent large documents from freezing the editor interface.

---

# 34. Responsive Design

ZeroPDF must work on:

* Desktop
* Tablet
* Mobile

Desktop remains the most capable editing surface.

Mobile should prioritize:

* Signing
* Filling
* Adding text
* Simple annotation
* Downloading

Page manipulation can use bottom sheets rather than persistent sidebars.

---

# 35. Mobile Layout

```text
┌───────────────────────┐
│ ←   document.pdf   ⋮  │
├───────────────────────┤
│                       │
│                       │
│       PDF PAGE        │
│                       │
│                       │
├───────────────────────┤
│ Select Text Sign Draw │
├───────────────────────┤
│       DOWNLOAD        │
└───────────────────────┘
```

Touch targets:

Minimum approximately **44 × 44 CSS pixels**.

---

# 36. Accessibility

Target WCAG 2.2 AA for application chrome.

Requirements:

* Keyboard navigation
* Visible focus states
* ARIA labels
* Accessible toolbar semantics
* Sufficient contrast
* Screen-reader-accessible controls
* Non-color-only state indicators

The PDF document itself may have accessibility characteristics outside ZeroPDF's control.

---

# 37. Failure States

ZeroPDF should explicitly handle:

### Invalid PDF

> This file doesn't appear to be a valid PDF.

### Password-Protected PDF

> This PDF is encrypted. Enter its password to continue.

where technically supported.

### Unsupported Encryption

Explain rather than crashing.

### Corrupted Document

Provide a useful error state.

### Memory Limit

> This document is too large for this device to process reliably.

### Failed Export

Preserve editing state where possible and allow retry.

---

# 38. Local Recovery

A browser crash or accidental refresh could otherwise destroy substantial work.

Post-v1 investigation:

Use IndexedDB to create **explicit local recovery sessions**.

Important distinction:

```text
Local device persistence
≠
Cloud storage
```

A privacy mode should allow users to disable persistence completely.

For initial v1, session-only editing is acceptable.

---

# 39. Technology Stack

Recommended:

```text
Vite
TypeScript
React
PDF.js
pdf-lib
Tailwind CSS
Lucide
Vitest
Playwright
GitHub Actions
```

React is primarily useful for application state and complex editor interactions.

If bundle minimization becomes a higher priority, parts of the editor can be implemented with framework-light TypeScript.

---

# 40. Suggested Internal Architecture

```text
src/
├── app/
│   ├── App.tsx
│   └── routes/
│
├── editor/
│   ├── Editor.tsx
│   ├── CanvasViewport.tsx
│   ├── PageLayer.tsx
│   ├── AnnotationLayer.tsx
│   └── SelectionLayer.tsx
│
├── tools/
│   ├── select/
│   ├── text/
│   ├── ink/
│   ├── signature/
│   ├── shapes/
│   ├── images/
│   └── whiteout/
│
├── pdf/
│   ├── loader.ts
│   ├── renderer.ts
│   ├── coordinates.ts
│   ├── forms.ts
│   ├── pages.ts
│   └── exporter.ts
│
├── state/
│   ├── documentStore.ts
│   ├── historyStore.ts
│   └── toolStore.ts
│
├── components/
├── workers/
└── utils/
```

---

# 41. Application State Machine

```text
EMPTY
  │
  ▼
LOADING
  │
  ├── ERROR
  │
  ▼
READY
  │
  ▼
EDITING
  │
  ├──── SAVE/EXPORT
  │          │
  │          ▼
  │      EXPORTING
  │          │
  │          ▼
  └──────── READY
```

An explicit state model prevents tool interactions from leaking into document-loading and export states.

---

# 42. Security Threat Model

ZeroPDF should explicitly consider:

## Malicious PDFs

PDFs are untrusted input.

The app should rely on maintained PDF parsing libraries and avoid executing embedded scripts.

## Embedded JavaScript

Do not intentionally execute arbitrary JavaScript contained in PDFs.

## External Resources

Do not automatically fetch arbitrary URLs referenced inside documents.

## File Exfiltration

No editor feature should automatically transmit document content.

## Third-Party Dependencies

Pin and audit production dependencies.

Use automated dependency scanning through GitHub.

---

# 43. Testing Strategy

## Unit Tests

Test:

* Coordinate transforms
* Page ordering
* Rotation
* Annotation serialization
* History stack
* Filename handling

## Integration Tests

Test:

```text
Open → Add Text → Export
Open → Sign → Export
Open → Fill Form → Export
Open → Reorder → Export
Open → Merge → Export
```

## PDF Compatibility Corpus

Maintain test documents representing:

* Standard PDFs
* Scanned PDFs
* AcroForms
* Rotated pages
* Landscape documents
* Image-heavy PDFs
* Very large documents
* Encrypted PDFs
* Non-standard fonts
* Broken PDFs

---

# 44. MVP Definition

ZeroPDF v1 ships when a user can reliably:

1. Open a PDF.
2. View every page.
3. Zoom and navigate.
4. Add text.
5. Draw.
6. Highlight.
7. Sign.
8. Insert an image.
9. Fill supported form fields.
10. Move and resize added content.
11. Rotate pages.
12. Delete pages.
13. Reorder pages.
14. Merge another PDF.
15. Undo and redo.
16. Export a valid PDF.
17. Do all of the above without uploading the document.

Everything else is secondary.

---

# 45. Development Milestones

## M0 — Foundation

* Vite
* TypeScript
* React
* Testing
* CI/CD
* Static deployment

**Exit criterion:** Application deploys automatically.

---

## M1 — Viewer

* File picker
* Drag/drop
* PDF.js
* Multi-page rendering
* Zoom
* Fit width
* Fit page
* Page navigation
* Thumbnails

**Exit criterion:** PDFs can be reliably opened and viewed.

---

## M2 — Annotation Engine

* Canonical coordinate system
* Annotation model
* Selection engine
* Text
* Drawing
* Highlighting
* Shapes
* Undo/redo

**Exit criterion:** Added content survives zooming and page navigation.

---

## M3 — Export Engine

* pdf-lib integration
* Text embedding
* Shape serialization
* Image serialization
* Ink serialization
* Blob download

**Exit criterion:** Reopened exported PDFs reproduce edits accurately.

---

## M4 — Signatures & Forms

* Draw signature
* Type signature
* Upload signature
* AcroForm detection
* Field editing
* Flatten option

**Exit criterion:** Common contracts and forms can be completed without another tool.

---

## M5 — Page Operations

* Reorder
* Rotate
* Delete
* Duplicate
* Merge
* Extract

**Exit criterion:** ZeroPDF handles the majority of everyday PDF organization tasks.

---

## M6 — Privacy & Hardening

* CSP
* Dependency audit
* Malicious-file testing
* Memory profiling
* Browser compatibility
* Mobile optimization
* Accessibility audit

**Exit criterion:** v1.0 production release.

---

# 46. Acceptance Criteria

A release candidate passes only if:

### Privacy

Opening, editing, and exporting a local PDF generates no document-upload requests.

### Core Functionality

All MVP workflows pass automated and manual testing.

### Compatibility

Latest stable versions of:

* Chrome
* Edge
* Firefox
* Safari

must support the core experience.

### Output Integrity

Exported PDFs reopen successfully in at least:

* Browser PDF viewer
* macOS Preview
* Adobe Acrobat Reader

### Persistence

Refreshing the page must not unexpectedly upload or remotely persist document data.

### Security

No analytics or telemetry endpoints exist in the production application.

---

# 47. Product Metrics Without Surveillance

Because ZeroPDF intentionally avoids telemetry, success should not depend on invasive analytics.

Public project-level indicators may include:

* GitHub stars
* GitHub forks
* Issues
* Pull requests
* Release downloads where available
* Community contributions
* Search traffic reported by hosting infrastructure without document-level tracking

The application itself should not monitor what users do with documents.

---

# 48. Open Source Strategy

Recommended license:

**AGPL-3.0**, **GPL-3.0**, or another license selected according to the desired commercialization policy.

If maximum adoption and embedding are more important than protecting hosted derivatives, an MIT or Apache-style license may instead be appropriate.

The license decision should therefore be intentional rather than incidental.

---

# 49. Brand Positioning

ZeroPDF should not position itself as:

> Another online PDF editor.

Position it as:

> **The PDF editor that doesn't upload your PDF.**

Potential supporting lines:

**Your files. Your browser. That's it.**

**Edit PDFs without uploading them.**

**No account. No cloud. No paywall.**

**The device is the server.**

---

# 50. Product Moat

The moat is not proprietary PDF technology.

The moat is discipline.

Competitors are economically incentivized to introduce:

* Accounts
* Cloud storage
* Upsells
* Usage limits
* Tracking
* Enterprise funnels

ZeroPDF's advantage is maintaining an intentionally constrained architecture:

```text
Static
Local
Private
Fast
Free
Understandable
```

The simplicity itself becomes the product.

---

# 51. Future Roadmap

After v1:

### v1.1

* PWA / offline installation
* Local recovery
* Better keyboard editing
* Stamp library
* Improved mobile signing

### v1.2

* Split PDF
* Compression
* Metadata editor
* Page numbering
* Headers and footers
* Watermarks

### v1.5

Evaluate:

* OCR using local WebAssembly
* Local-only text recognition
* Searchable scanned documents
* Local image compression
* Local document conversion

### v2

Research:

* Existing-content editing
* Cryptographic digital signatures
* Verified secure redaction
* Advanced PDF annotation compatibility
* Optional desktop wrapper

All remain subject to the foundational rule:

> **If a feature requires uploading the user's document, it should not silently become part of ZeroPDF.**

---

# 52. Final Product Contract

ZeroPDF should ultimately be explainable in one sentence:

> **Open a PDF, change what you need, download it again—and the document never leaves your device.**

That statement is both the product specification and the architectural constraint.

Every feature should be evaluated against it.

The biggest product decision I made here is **not pretending v1 can edit arbitrary existing PDF text**. That feature alone can turn a four-week utility into a much larger PDF-engine project. The architecture above still lets users accomplish the common "change this text" workflow through **cover + replacement text**, while preserving a realistic path to ship.

I’d also consider making **“The device is the server.”** part of the ZeroPDF brand rather than just an architecture note. It explains the entire product in five words.
