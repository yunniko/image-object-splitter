# D010 · Downloaded tiers styled green; "Retry with tier" re-runs on stored bytes
Date: 2026-09-09 · Goal: G-001 · Status: active
Context: Owner requests.
Decision: A tier card turns green when previously downloaded, independent of selection; decoded bytes are kept in state so switching tiers offers a retry without re-upload.
Rejected: —
Consequence: e2e includes a real two-model-download retry test (~50 s).
Evidence: `app/_components/background-remover-tool.tsx`.
