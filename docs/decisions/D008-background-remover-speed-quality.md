# D008 · Background-remover speed/quality complaints investigated: separate findings
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Owner reported slow, noisy results and holes inside objects.
Decision: (1) WASM multithreading is off because the page is not cross-origin isolated; the COEP header needed would likely break AdSense iframes — Owner chose to hold until ads are confirmed rendering. (2) GPU device plus worker proxying shipped (safe fallback; benefit unmeasurable here on a software WebGPU adapter). (3) The model tier was the smallest (42 MB vs 84/168 MB) — became a user choice (D009). (4) Holes are a model limitation; a border-flood-fill heuristic was rejected because it would also erase genuine see-through gaps.
Rejected: unilateral COEP or tier change.
Consequence: Revisit COOP/COEP once AdSense is confirmed.
Evidence: `lib/background-remover.ts`; the library's model-size manifest.
