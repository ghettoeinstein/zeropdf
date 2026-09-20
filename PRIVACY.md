# Privacy architecture

ZeroPDF processes documents in the browser. File inputs expose bytes to the local app; PDF.js renders those bytes, pdf-lib generates output, and a Blob URL triggers a local download. No document upload endpoint exists.

## Requests

The browser fetches the application's HTML, CSS, JavaScript, PDF worker, and bundled signature font from the static host. The production Content Security Policy blocks fetch, XHR, WebSocket, beacon, and related connections with `connect-src 'none'`. Assets still load under their respective script, worker, font, and image directives. The development server permits same-origin connections for live reload.

PDFs are opened from byte arrays, never a user-supplied remote URL. The application does not execute PDF JavaScript, follow document links, load arbitrary external document resources, or embed third-party analytics. PDF.js is configured without WebAssembly resource fetching. Some complex PDFs may therefore render with reduced fidelity; compatibility needs broader corpus testing.

The static host may log normal asset requests, including IP addresses. Those requests do not contain document bytes. Browser extensions, operating-system services, and downloaded file handling are outside this application's control.

## Storage and lifecycle

Document bytes, editable state, undo snapshots, images, and signatures exist in application memory. No localStorage, IndexedDB, cookies, or cloud storage is used for documents. Original files are not overwritten. Downloaded output is saved by the browser to the user's chosen location. Blob URLs are revoked after download; replaced document workers are destroyed. A browser close or refresh ends the session.

## Visible limitations

Whiteout is a visual mask, not secure redaction. Signatures are visible marks, not cryptographic certification. Ordinary exports do not remove metadata, hidden content, or all pre-existing PDF features. ZeroPDF is not a PDF sanitization tool.

## Verification

Build and preview the production app. Open the browser's Network panel, then import, edit, and export a local PDF. There should be no upload or processing requests. A signature may load its bundled local font. The automated Chromium suite monitors network requests during the open/edit/export workflow and checks the production app for uncaught errors. This test supports, but does not replace, a broader security review.
