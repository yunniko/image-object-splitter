# Handover — image-object-splitter
Last verified: 2026-09-12 at 718c471

svc-lab service #8, the first ML-based one. Goal: `GOALS.md` G-001. Shared conventions:
`E:\CLAUDE\projects\svc-lab\`; charter: `E:\CLAUDE\COMPANY\`.

## Current state

- **Live** at https://image-object-splitter.svc.julienika.cz (deployed 2026-09-08, port 30120;
  HTTP 200 re-checked 2026-09-12).
- Three tools, all on-device, no server-side processing: object splitter (TensorFlow.js
  coco-ssd `lite_mobilenet_v2`, optional per-crop background removal, optional resize-to-box),
  split-by-color (connected-component segmentation, no ML), background remover (three model
  tiers with real sizes, progress, downloaded-before hint, retry).
- Verification on 2026-09-12: `npm run test:unit` 43/43. e2e (real model inference, needs
  `npm run fetch-test-fixtures`) last green 2026-09-09.
- Git tree clean.

## How things fit together

- `lib/geometry.ts` (pure crop math, `padAndClampBox`, `computeContainFit`),
  `lib/zip-export.ts`, `lib/trigger-download.ts`.
- `lib/object-detector.ts` and `lib/background-remover.ts` dynamically import their ML deps
  (keeps them out of every other page's bundle) and expose size constants, progress callbacks
  and localStorage "downloaded before" hints.
- `lib/color-segmenter.ts` (pure, unit-tested) + `lib/crop-image.ts` (canvas side).
- `app/_components/`: one tool component each plus shared `resize-controls.tsx`, `spinner.tsx`.

## Rules in force

- Keep everything client-side; the privacy pitch depends on it literally being true.
- `removeImageBackground` requires an explicit MIME type (D002). Detect at 0.5 and only raise
  the UI threshold (D003). Route all crop math through `padAndClampBox`.
- Every model download shows its real size and status before it starts (D009, D011).
- `npm ci --legacy-peer-deps`; e2e is slow by design (real models); run `npm run build` before
  calling ML-wrapper changes done.

## Next steps and open questions

- COOP/COEP for WASM multithreading is on hold until AdSense is confirmed rendering on this
  domain (Owner decision, D008).
- Deferred guards: downscale for very large photos (both detector and colour segmenter);
  untuned `minRegionArea` and the 0–40% tolerance range (no real icon sheets to test against).
- Optional: a "more accurate" coco-ssd base model; per-object thumbnails in the selection list.
- AdSense per-domain approval unconfirmed (portfolio-wide).

## Deploy log

| Date | Commit | What changed | Verified how |
|---|---|---|---|
| 2026-09-08 | — | First deploy (port 30120) after an interactive re-verification (D005) | Full suite incl. real inference; routes 200 |
| 2026-09-08 | — | Split-by-color, resize-to-box, quality tiers (D006–D009) | Full suite; manual browser checks |
| 2026-09-09 | 718c471 | Green tiers, retry, detector disclosure (D010–D011) | Full suite incl. two-model retry e2e |

## Decisions

`docs/decisions/README.md` (D001–D011).
