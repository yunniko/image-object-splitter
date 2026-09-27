# D002 · Three real background-removal library integration bugs, caught by building and running
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: WebSearch summaries of the imgly README were wrong; WebFetch denied.
Decision: (1) only the named export `removeBackground` exists (the root re-export never carries a default); (2) `Config.model` is `isnet | isnet_fp16 | isnet_quint8`; (3) a bare `Uint8Array` fails at runtime because the library builds an untyped Blob and decodes by `blob.type` only. `removeImageBackground` therefore requires an explicit MIME type and builds a typed Blob.
Rejected: passing raw bytes as the published types allow.
Consequence: A library's shipped `.d.ts` beats search summaries, and neither replaces a failing run on real input.
Evidence: `lib/background-remover.ts` header.
