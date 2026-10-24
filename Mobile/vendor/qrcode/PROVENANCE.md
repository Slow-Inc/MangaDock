# Vendored QR encoder core

These ten JavaScript files are copied unchanged from the QRCode vendor directory of locally installed `qrcode-terminal` 0.12.0 (distributed with npm). Their SHA-256 digests are recorded in CHECKSUMS.json.

The repository marks these JavaScript files `-text` in `.gitattributes` to preserve their original CRLF bytes on every platform. Upstream whitespace is retained intentionally; do not reformat these files without explicitly updating provenance and digests. Git-index checks initially matched 0/10 digests under automatic LF normalization and match 10/10 with this rule; the working copies already matched 10/10.

The original index.js identifies Kazuhiko Arase, Copyright (c) 2009, and explicitly licenses this QR encoder under MIT. The terminal wrapper is Apache-2.0 and is not included or used here. The package metadata beside the copied files only declares their CommonJS module format.

Upstream: https://github.com/gtanner/qrcode-terminal/tree/v0.12.0/vendor/QRCode
Original project: https://www.d-project.com/

Mobile/src/qr.ts supplies UTF-8 bytes, uses ECC M, preserves a four-module quiet zone, and converts the generated matrix into integer native rectangles. A fixture generated with the independent Python qrcode encoder checks the complete rendered pattern against all eight valid masks; Python is not required to run the Mobile test suite.

This is a buildable fallback while this environment cannot reach the npm registry. Future maintenance should verify upstream provenance and decide whether to retain the vendored core or use a normally installed native QR component. Physical banking-app scanning remains a release acceptance check.
