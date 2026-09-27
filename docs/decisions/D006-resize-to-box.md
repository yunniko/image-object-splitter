# D006 · Optional "resize exports to fit a box" (contain-fit, never deform)
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Owner request.
Decision: `computeContainFit` (pure, unit-tested including a never-stretch check) plus `resizeBytesToBox` (canvas) with transparent or solid fill; shared `resize-controls.tsx`. Verified by a PNG-IHDR reader in e2e and a manual pixel-colour check.
Rejected: —
Consequence: —
Evidence: `lib/geometry.ts`; `tests/e2e/helpers/read-png-dimensions.ts`.
