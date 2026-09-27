# D005 · The D003 revoke-URL fix promised caller-side revocation that no code did; fixed
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Found while re-verifying D003 before shipping (the automation stopped on budget first).
Decision: Both preview components track the current object URL in a ref, revoke it before replacement and on unmount.
Rejected: —
Consequence: Full build + e2e re-run clean after this plus D003.
Evidence: `app/_components/object-splitter-tool.tsx`; `app/_components/background-remover-tool.tsx`.
