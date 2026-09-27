# D004 · Bounding-box overlays use CSS percentages of a wrapper sized to the image
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Tracking rendered pixel size needs a ResizeObserver and can drift.
Decision: Box coordinates as percentages of an absolutely positioned wrapper; correct at any rendered size.
Rejected: pixel tracking.
Consequence: —
Evidence: `app/_components/object-splitter-tool.tsx`.
