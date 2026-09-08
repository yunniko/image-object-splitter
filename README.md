# image-object-splitter

Two browser-based photo tools, both computed entirely on-device (nothing is
ever uploaded): an object splitter that detects the distinct objects in a
photo and exports each as its own image, and a standalone background
remover. Part of the `svc-lab` portfolio (see `E:\CLAUDE\projects\svc-lab\`).

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

The e2e suite for both tools downloads and runs real AI models
(TensorFlow.js + coco-ssd for detection, an ONNX segmentation model for
background removal) inside a real headless browser — expect it to take
noticeably longer than a typical svc-lab service's e2e suite, especially
the background-remover test on a first run before the model is cached.

## Current state

See `HANDOVER.md` for the ML-library integration notes, the API-mismatch
bugs `npm run build` caught, and the testing-strategy decision record; see
`GOALS.md` for the full build history; see `docs/domain-reference.md` for
the domain-expert review of the computer-vision/image-processing claims
this project makes.
