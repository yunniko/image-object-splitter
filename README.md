# image-object-splitter

Three browser-based image tools, all computed entirely on-device (nothing is
ever uploaded): an object splitter that detects the distinct objects in a
photo (AI-based, coco-ssd) and exports each as its own image, a
background-color splitter that cuts apart an icon/sprite sheet by connected-
component color segmentation (no AI — deterministic pixel analysis), and a
standalone background remover. The object splitter and the color splitter
both support an optional "resize to fit a box" export step (upscale/
downscale to an exact width/height without deforming, letterboxed with a
transparent or solid-color fill). Part of the `svc-lab` portfolio (see
`E:\CLAUDE\projects\svc-lab\`).

## Running it

```
npm install --legacy-peer-deps
npm run dev
```

Production build/run: `docker compose --profile app up -d --build`
(no database — stateless).

## Tests

```
npm run fetch-test-fixtures   # downloads the real test photo used by e2e tests (gitignored, not committed — see HANDOVER.md)
npx vitest run                # unit tests — pure crop-geometry and zip-export logic
npx playwright test           # e2e — real browser flows, including real on-device model inference
```

The object-splitter and background-remover e2e tests download and run real
AI models (TensorFlow.js + coco-ssd for detection, an ONNX segmentation
model for background removal) inside a real headless browser — expect them
to take noticeably longer than a typical svc-lab service's e2e suite,
especially on a first run before the model is cached. The split-by-color
tests need no model and no fetched fixture: they generate a small synthetic
PNG in-test (`tests/e2e/helpers/synthetic-png.ts`) with exact, known pixel
placement, so they run fast and assert deterministically.

## Current state

See `HANDOVER.md` for the ML-library integration notes, the API-mismatch
bugs `npm run build` caught, and the testing-strategy decision record; see
`GOALS.md` for the full build history; see `docs/domain-reference.md` for
the domain-expert review of the computer-vision/image-processing claims
this project makes.
