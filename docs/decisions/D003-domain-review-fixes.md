# D003 · Domain review found three source-verified bugs; fixed same run
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Mandatory domain gate.
Decision: coco-ssd's `infer()` passes `minScore` as both the score and the NMS IoU threshold, so "detect low, filter client-side" changed which boxes survived — now always detect at 0.5 and only raise the UI threshold; a revoked-blob-URL bug; a 1 px overflow in `padAndClampBox` rounding. Deferred: a downscale guard for very large photos; a fuller fur/hair edge-quality FAQ note.
Rejected: keeping the low-threshold design.
Consequence: The 0.5 detect-time threshold is load-bearing.
Evidence: `docs/domain-reference.md`.
