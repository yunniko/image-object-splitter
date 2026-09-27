# D009 · Model quality is a user choice with real sizes, an honest "downloaded before" hint and a real progress bar
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Owner directive resolving D008.
Decision: `MODEL_TIERS` with byte-exact sizes; default `isnet_fp16` (the library's own). No browser API reveals cross-origin cache state, so a localStorage marker says "downloaded before in this browser", never "cached". Progress uses the library's real per-resource callback, never blended into one percentage. `useSyncExternalStore` for the localStorage read (SSR-safe).
Rejected: claiming "cached"; a fake blended progress bar.
Consequence: Balanced tier ~33 s versus Fast ~20–24 s on the fixture; the cost is real.
Evidence: `lib/background-remover.ts`; `tests/e2e/`.
