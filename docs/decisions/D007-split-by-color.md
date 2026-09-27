# D007 · "Split by background color" is connected-component labelling, not coco-ssd
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Owner asked about icon sets on a flat background; coco-ssd knows 80 photo classes, not icons.
Decision: `lib/color-segmenter.ts`: corner-guessed background colour (overridable), tolerance, 8-connectivity BFS, colour-keyed transparency, no ML model. Detection is a live `useMemo`; shared `trigger-download.ts` and `resize-controls.tsx` extracted so both tools stay identical. Not a domain-expert case (established CS technique); the FAQ discloses limits (touching items merge; gradients are hard).
Rejected: stretching the AI detector.
Consequence: 19 unit + 5 synthetic-PNG e2e tests; drive React colour inputs in Playwright through the native value setter.
Evidence: `lib/color-segmenter.ts`; `tests/e2e/helpers/synthetic-png.ts`.
