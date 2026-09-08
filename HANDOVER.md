# Handover — image-object-splitter

Read this before touching the project. Goal in `GOALS.md` (G-001). Parent
initiative in `E:\CLAUDE\projects\svc-lab\`; company-wide standards in
`E:\CLAUDE\COMPANY\`.

## Current state

**Live at https://image-object-splitter.svc.julienika.cz** (deployed
2026-09-08). Built by the svc-lab daily automation loop (which stopped
safely on session budget after its domain-expert fixes, before
re-verifying or shipping); an interactive session independently
re-verified the full suite (catching and fixing one more real bug in
the process, D5), then shipped. Two tools, no database, no accounts, no
server-side computation of any kind — detection, cropping, and
background removal all run on-device via TensorFlow.js and
`@imgly/background-removal`. The first ML-based service in the svc-lab
portfolio (every prior service was a pure-calculation calculator/converter/
generator).

## How things fit together

- `lib/types.ts` — shared `BoundingBox`/`ImageSize`/`Detection` types.
- `lib/geometry.ts` — pure, unit-tested crop math: `padAndClampBox` (expand
  a detection's box by a padding ratio, clamp to the image's own bounds so
  a crop can never read outside the source image's real pixel data),
  filename slugification, and per-class export numbering
  (`assignPerClassIndices` — "cat-1.png", "cat-2.png", not overall-index
  numbering that leaves gaps between classes).
- `lib/zip-export.ts` — a thin JSZip wrapper that takes/returns raw
  `Uint8Array`, not a browser `Blob`, so it works identically in Node
  (Vitest) and the browser.
- `lib/object-detector.ts` — dynamically imports TensorFlow.js + coco-ssd
  (lazy, cached module-level promise) and maps coco-ssd's own prediction
  shape to this project's `Detection` type. Uses the `lite_mobilenet_v2`
  base model — coco-ssd's smallest/fastest option.
- `lib/crop-image.ts` — canvas-based cropping (`cropToPngBytes`) and
  `loadImageFromFile` (File → HTMLImageElement via an object URL).
- `lib/background-remover.ts` — wraps `@imgly/background-removal`. Takes/
  returns raw bytes plus an explicit MIME type (see D2 for why the MIME
  type can't be skipped). Shared by both tools: the background-remover
  page runs it on a whole uploaded photo; the object-splitter runs it
  per-crop when the user opts in.
- `app/_components/object-splitter-tool.tsx` — the heavier of the two UI
  components: detects on file upload, renders bounding boxes as
  percentage-positioned absolutely-positioned `<div>`s over the displayed
  `<img>` (works at any rendered size without tracking pixel dimensions —
  see D4), lets the user filter by confidence, adjust padding, toggle
  per-export background removal, and export a single PNG or a zip.
- `app/_components/background-remover-tool.tsx` — simpler: upload → run
  `removeImageBackground` on the whole file → preview over a checkerboard
  (CSS gradient, no image asset) → download PNG.
- Each `app/<tool>/page.tsx` carries SEO metadata, FAQ copy, and JSON-LD;
  the interactive tool itself lives in `app/_components/`.

## Decision record

**D1 — The Playwright e2e fixture is a real photo (the standard COCO
"two cats on a couch" demo image, `http://images.cocodataset.org/val2017/
000000039769.jpg`), fetched on demand rather than committed to git.**
Testing real object detection needs a real, recognizable photograph — a
procedurally-generated or hand-drawn test image would not reliably trigger
a real trained CNN's detections, and mocking the model out entirely would
mean never verifying the actual TensorFlow.js/coco-ssd integration works
end to end (the pipeline's whole value proposition). This specific image is
the field's de facto standard object-detection demo/test image (used
throughout Hugging Face's and other ML frameworks' own documentation) and
is served by the COCO dataset's own public server specifically for this
kind of use. It was **not** committed to this project's public repo,
though: COCO images are individually sourced from Flickr under a mix of
per-photo Creative Commons licenses that weren't individually verified for
this specific image, and every other svc-lab repo is public. Instead,
`scripts/fetch-test-fixtures.mjs` downloads it into `tests/e2e/fixtures/`
(gitignored) on demand — the same "generate/fetch fixtures, don't commit
them" pattern `epub-metadata-fixer` used for its own synthetic fixtures,
adapted here because this fixture has to be a real photo rather than
something this project can generate itself. `tests/e2e/*.spec.ts` throw a
clear error naming the exact command to run if the fixture is missing,
rather than silently skipping the test.

**D2 — Three real integration bugs against `@imgly/background-removal`
were caught by actually building and running the code, not by trusting
WebSearch-sourced documentation (WebFetch to the package's own README was
denied this run, same limitation as every other svc-lab service).** All
three are logged in `lib/background-remover.ts`'s own header comment too,
since a future change to this file needs to know them:
  1. **Wrong export name.** Search summaries described a default export
     (`imglyRemoveBackground`). The package's actual root `index.d.ts` does
     `export * from './api/v1'`, which per ES module semantics never
     re-exports a default binding — only the named export `removeBackground`
     is available from the package root. Caught by `npm run build`'s
     TypeScript check ("This expression is not callable").
  2. **Wrong `model` config values.** Search summaries described `"small"`/
     `"medium"`. The actual `Config.model` enum (read from the package's own
     shipped `dist/src/schema.d.ts`) is `"isnet" | "isnet_fp16" |
     "isnet_quint8"`. Also caught by the same build-time type check, not
     discovered by re-reading documentation.
  3. **A real bug in the library itself**, not just a usage mistake here:
     passing a bare `Uint8Array` (which the library's own `ImageSource` type
     declares as accepted) fails at runtime. `imageSourceToImageData` in
     `dist/index.mjs` does `new Blob([image])` with no `type` set when given
     an ArrayBuffer/TypedArray, then `imageDecode` switches purely on
     `blob.type` with **no magic-byte sniffing** — an untyped Blob always
     hits the `default` case and throws `Invalid format: with params:
     [object Object]`. This was NOT caught by the build (it's a runtime
     failure, and TypeScript has no way to know the type is technically
     accepted but practically broken) — it was caught by an actual failing
     Playwright e2e run against the real photo fixture, exactly the kind of
     bug VALUES.md's "done means verified by actually running it" principle
     exists to catch. Worked around by changing `removeImageBackground`'s
     signature to require the caller's real MIME type and constructing a
     correctly-typed `Blob` before calling the library, rather than ever
     passing raw bytes to it.
  The lesson generalized: for this project specifically, and worth
  remembering for any future svc-lab service that integrates a third-party
  ML/WASM library, a library's own shipped `.d.ts` is more trustworthy than
  search-engine summaries of its README, but neither substitutes for an
  actual failing run against real input — this bug's type signature was
  perfectly valid TypeScript and still broken at runtime.

**D3 — Domain-expert review (2026-09-08) found three real, source-verified
bugs, not just documentation gaps — all three fixed same run.** Full detail
in `docs/domain-reference.md`. Highest severity: coco-ssd's own `infer()`
passes `minScore` as BOTH the score threshold and the IoU threshold to
non-max suppression (verified directly against the vendored
`coco-ssd.js`), so this project's original "detect once at a low threshold,
re-filter client-side" design silently changed which boxes survived
suppression, not just which were displayed — fixed by always detecting at
coco-ssd's own documented default (0.5) and only ever raising the UI
threshold from there. Also fixed: a revoked-blob-URL bug where the object
URL backing the preview `<img>` was revoked before a new element ever
loaded it (spec-compliant browsers fail this — not independently
re-verified live afterward, session budget ran out first, see next steps);
and a 1px image-bound overflow possible in `padAndClampBox`'s rounding.
Deferred to a later session: a downscale guard against OOM on very large
photos, and a fuller FAQ disclosure of the background-remover's fur/hair
edge-quality tradeoff. See `docs/domain-reference.md` for the complete
finding-by-finding detail and reviewer confidence levels.

**D5 — The revoked-blob-URL fix (D3) had an unfulfilled promise: its own
comment said "the caller owns revoking it — when a new photo replaces
this one, or on unmount," but no code actually did that.** Found while
independently re-verifying D3's fixes before shipping (the run that made
them stopped on session budget before this re-check happened — see
`GOALS.md`'s progress log). Neither `object-splitter-tool.tsx` nor
`background-remover-tool.tsx` (same object-URL-for-preview pattern) ever
called `URL.revokeObjectURL` on the *previous* result when a new one
replaced it, or on unmount — a real memory leak on repeated use within
one session (not a correctness bug for a single upload, since browsers
don't reuse blob URL slots, but blob URLs otherwise live until the page
unloads). Fixed both components: a ref tracks the current URL, revoked
right before being replaced by a new one, and in a `useEffect` cleanup
on unmount. Re-verified with a full fresh `npm run build` +
`npx playwright test` run (including real on-device model inference
against the real photo fixture) after this fix plus D3's original
three — all clean, nothing regressed.

**D4 — Bounding-box overlays are positioned with CSS percentages of a
wrapper sized to the displayed `<img>`, not by tracking the image's
rendered pixel dimensions.** Since `box.x / imageSize.width * 100` (etc.)
as a percentage of an absolutely-positioned parent that's exactly the
rendered size of the `<img>` scales correctts regardless of actual on-screen
size (responsive layout, window resize, high-DPI), this avoids needing a
`ResizeObserver` or any pixel-tracking logic entirely — simpler and can't
drift out of sync with a resize the way a cached-pixel-size approach could.

## Owner action list

- AdSense approval status for this domain is unconfirmed, same as every
  other svc-lab service — ask the Owner to check the AdSense dashboard.

## Next steps and open questions

- `lib/object-detector.ts` always loads the `lite_mobilenet_v2` base model
  at a fixed 0.3 detect-time threshold, with the UI-side confidence slider
  re-filtering client-side afterward. If traffic ever justifies it, a
  "more accurate" mode using coco-ssd's larger `mobilenet_v2` base could be
  offered as an opt-in — not built this run to keep the initial model
  download small for every user by default.
- No IANA-registry-style validation of upload file type beyond the file
  picker's own `accept` attribute (which a user can override) — an
  unsupported format simply surfaces as this project's own "Couldn't
  process this photo" / "Couldn't read this file as an image" error
  messages rather than a more specific one. Acceptable for a first ship;
  revisit if real users report confusing failures.
- If this service's traffic justifies more investment, consider adding
  per-object live thumbnail previews to the selection list (currently just
  a color-coded label + confidence %, no cropped preview) — deferred this
  run to keep scope to a single day's build given the two tools' combined
  size, per the backlog note's own "budget more of the day's session for
  this" guidance.
