# Security

PDF files are untrusted input. Keep parsing dependencies current and review automated dependency updates.

## Architecture

- No application server, authentication service, document storage, or upload route.
- Production CSP blocks outbound connections and plugins; scripts and workers are same-origin.
- Inline styles are allowed for dynamic document coordinates and React styles. Inline scripts and eval are not allowed.
- Embedded PDF scripts are not executed by this application. Annotation links and external resources are not interactive.
- Encrypted input is rejected because the export library cannot safely modify it.
- Input parsing and export failures preserve the active editing session when possible.

## Before calling this a v1 production release

- Test a broader corpus, including malformed, large, scanned, unusual-font, rotated, and form-heavy documents.
- Verify latest stable Firefox, Safari, Chrome, and Edge.
- Reopen representative outputs in Adobe Acrobat Reader and macOS Preview.
- Audit accessibility, touch controls, long-session memory use, and malicious input behavior.
- Verify the production CSP on the chosen static host.
- Select a project license and configure the repository's vulnerability reporting channel.

Do not include private documents or secrets in public bug reports. Use a synthetic reproduction. If GitHub private vulnerability reporting is enabled for the repository, use its Security tab for sensitive reports.
