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
the process, D5), then shipped. No database, no accounts, no server-side
computation of any kind — detection, cropping, and background removal all
run on-device via TensorFlow.js and `@imgly/background-removal`. The first
ML-based service in the svc-lab portfolio (every prior service was a
pure-calculation calculator/converter/generator).

Three tools as of 2026-09-08's later same-day session (D6/D7 below,
Owner-directed): object splitter (AI-based), split-by-color (a second,
deliberately non-AI icon/sprite-sheet splitter), and background remover.
The object-splitter and split-by-color tools both offer an optional
"resize exports to fit a box" step (D6).

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
- `lib/crop-image.ts` — canvas-based cropping (`cropToPngBytes`),
  `loadImageFromFile` (File → HTMLImageElement via an object URL),
  `resizeBytesToBox`/`parseResizeTarget` (the shared resize-to-box export
  step, D6), and `imageToPixelBuffer`/`cropWithColorKeyToPngBytes` (the
  DOM-touching half of the color-splitter, D7 — reads/writes canvas pixel
  data; the actual segmentation algorithm lives in `lib/color-segmenter.ts`
  and never touches a canvas, so it can be unit-tested with plain arrays).
- `lib/color-segmenter.ts` — pure connected-component color segmentation
  (D7): `detectBackgroundColor` (guesses from the four corners),
  `segmentByBackgroundColor` (8-connectivity BFS flood-fill over a
  background/foreground pixel mask), `keyOutBackground` (color-keyed
  transparency), plus small `rgbToHex`/`hexToRgb` helpers for the color
  picker. No AI, no model download — deliberately a different, simpler
  technique than `lib/object-detector.ts`'s coco-ssd, for a different job
  (see D7).
- `lib/trigger-download.ts` — the "save these bytes as a file" browser
  download helper, shared by every export tool (extracted from
  `object-splitter-tool.tsx` when split-by-color needed the exact same
  logic — D7).
- `lib/background-remover.ts` — wraps `@imgly/background-removal`. Takes/
  returns raw bytes plus an explicit MIME type (see D2 for why the MIME
  type can't be skipped). Used by the background-remover page (on a whole
  uploaded photo) and, when the user opts in, by the object-splitter tool
  per-crop. **Not** used by split-by-color's own "make background
  transparent" option — that one already knows the exact background color,
  so it color-keys directly instead of running the heavier ML model (D7).
- `app/_components/object-splitter-tool.tsx` — the AI-based tool: detects
  on file upload, renders bounding boxes as percentage-positioned
  absolutely-positioned `<div>`s over the displayed `<img>` (works at any
  rendered size without tracking pixel dimensions — see D4), lets the user
  filter by confidence, adjust padding, toggle per-export background
  removal, optionally resize exports to a box (D6), and export a single PNG
  or a zip.
- `app/_components/color-split-tool.tsx` — the background-color splitter
  (D7): same overall export flow as object-splitter, but detection is a
  live-recomputed `useMemo` over `lib/color-segmenter.ts` (cheap enough to
  re-run on every background-color/tolerance change, unlike coco-ssd's
  one-shot inference) rather than a one-time async detection call.
- `app/_components/resize-controls.tsx` — the shared "resize exports to fit
  a box" UI, used by both object-splitter and color-split tools (D6/D7) so
  their two copies of this control can't silently drift apart.
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

**D6 — Added an optional "resize exports to fit a box" step (Owner-directed,
2026-09-08), shared between object-splitter and (same day, D7) split-by-
color.** A contain-fit, never-deform resize: `lib/geometry.ts`'s
`computeContainFit` (pure) computes the largest same-aspect-ratio rectangle
that fits the requested box, `lib/crop-image.ts`'s `resizeBytesToBox`
(canvas-based, via `createImageBitmap`) draws it centered onto a
`target.width`x`target.height` canvas, filling the leftover space either
with the canvas's own default transparency or a solid color the user picks.
Verified three ways: 7 unit tests on `computeContainFit`'s math (including
an explicit "never stretches width/height by different factors" check), a
real Playwright e2e run asserting the downloaded PNG's *exact* pixel
dimensions via a hand-rolled PNG-IHDR reader (`tests/e2e/helpers/
read-png-dimensions.ts` — avoids an image-decoding dependency just for a
test), and a manual real-browser check reading the downloaded file's actual
pixel colors with PowerShell's `System.Drawing` (confirmed a red fill color
rendered correctly at the canvas corner while the source photo's own colors
stayed centered) — dimension assertions alone wouldn't have caught a wrong
fill color, so this last check wasn't redundant with the automated ones.

**D7 — Added a third tool, "split by background color" (Owner-directed,
2026-09-08), deliberately NOT built on coco-ssd.** The Owner asked whether
the object splitter would work on "an icon set on a single color
background" — it wouldn't: coco-ssd only recognizes 80 real-world photo
classes and has no concept of an arbitrary icon/logo. Rather than stretch
the AI detector to a domain it was never trained for, this is a completely
different, simpler, and more precise technique for a different image
domain: connected-component labeling (8-connectivity BFS flood-fill) over a
background/foreground pixel mask, where "background" is a known color (auto
-guessed from the image's four corners, overridable via a color picker) and
"foreground" is everything else within a user-adjustable color-distance
tolerance. No ML model, no download, deterministic, and — because the exact
background color is already known — the "make background transparent"
option color-keys directly (`lib/color-segmenter.ts`'s `keyOutBackground`)
rather than running the heavier `@imgly/background-removal` model that the
other two tools use; a domain-appropriate choice, not a missed reuse
opportunity.
  - Detection is a `useMemo` recomputed live on every background-color/
    tolerance change (see `app/_components/color-split-tool.tsx`) rather
    than a one-shot detection like coco-ssd's — this surfaced a real
    `react-hooks/set-state-in-effect` ESLint error on the first draft (which
    called `setState` inside a `useEffect` to store the result); fixed by
    deriving `regions` via `useMemo` and adjusting the dependent `selected`
    state during render (the "adjust state during render" pattern from
    React's own docs), not in an effect — a correctness fix, not a style
    preference: the effect-based version could cascade extra renders.
  - Extracted `lib/trigger-download.ts` and `app/_components/
    resize-controls.tsx` out of `object-splitter-tool.tsx` so both tools
    share the identical download/resize-UI logic instead of carrying two
    copies that could drift apart; `object-splitter-tool.tsx` itself was
    refactored to use both, and its existing e2e tests were re-run
    unchanged (same aria-labels preserved) to confirm the refactor didn't
    change its behavior.
  - Not treated as needing a `domain-expert` review under
    `COMPANY\STANDARDS.md`'s "Domain depth" section: connected-component
    labeling and chroma-keying are established computer-science/software
    techniques, not a physical/chemical/biological/craft domain claim (the
    same category `fraction-calculator` was exempted from, per
    `svc-lab\automation\prompt.md` step 5's own scoping). The honesty bar
    applied instead: the FAQ copy explicitly discloses what this technique
    can't do (touching/overlapping items merge into one region; a gradient,
    textured, or shadowed background is harder to match) rather than
    presenting it as more capable than it is.
  - Verified with 19 new unit tests on `lib/color-segmenter.ts` (background
    detection, segmentation — including a dedicated diagonal-adjacency and
    a touching-shapes-merge case — noise-floor filtering, color-key
    transparency, hex conversion) using plain in-memory pixel arrays (no
    canvas needed), plus 5 new Playwright e2e tests against a synthetic PNG
    fixture generated in-test (`tests/e2e/helpers/synthetic-png.ts` — a
    from-scratch, dependency-free PNG encoder, chosen so the fixture's pixel
    layout is exact and deterministic rather than photo-noise-dependent). A
    real-browser manual check (PowerShell `System.Drawing` again) confirmed
    the transparency export produces an actually-transparent corner
    (alpha=0) and an actually-opaque, color-correct center pixel on a real
    downloaded file, not just on the unit-tested pure function in isolation.
  - One Playwright gotcha hit and fixed while writing the e2e tests:
    `locator.fill()` doesn't reliably drive a React-controlled
    `input[type=color]`, and even a raw `el.value = ...` + `dispatchEvent`
    from `page.evaluate` doesn't either — React wraps the native `value`
    setter to track "did this actually change," so a plain property
    assignment is invisible to it. Fixed by calling the *native* setter
    (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,
    'value').set`) before dispatching the `input`/`change` events, the
    standard workaround for driving a React-controlled input from outside
    simulated typing.

**D8 — Owner reported real quality/speed problems with the AI background
remover (2026-09-08): unclean results on noisy backgrounds, holes appearing
inside an object when part of it is close to the background color "even if
separated by outline," and it being "very slow." Investigated by reading
the vendored `@imgly/background-removal` source (not guessing) and fetching
its real model-size manifest — three separate, real findings, not one bug:**
  1. **Root cause of "very slow" (partially fixed): WASM multi-threading is
     completely disabled in production.** The library always sets
     `ort.env.wasm.numThreads = navigator.hardwareConcurrency` (12 in
     testing), but per its own `schema.ts` transform, that only actually
     multi-threads when the page is `crossOriginIsolated` — which requires
     `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` response
     headers this project doesn't send. Without them, ONNX Runtime Web
     silently falls back to single-threaded WASM (confirmed via the exact
     console warning seen in this project's own e2e test output:
     "WebAssembly multi-threading is not supported in the current
     environment"). **Not fixed this session** — `Cross-Origin-Embedder-
     Policy: require-corp` is well-documented to break third-party ad
     iframes/creatives that don't send `Cross-Origin-Resource-Policy`
     headers themselves, which describes most of the real-time-bidding
     ecosystem behind Google AdSense auto-ads. Since this whole svc-lab
     initiative's monetization depends on AdSense (see `svc-lab/GOALS.md`),
     and ads on this exact domain are still unconfirmed-rendering as of
     this session (see `svc-lab/GOALS.md`'s 2026-09-08 AdSense diagnosis
     entry), trading real, uncertain ad risk for real speed on one tool
     isn't a call to make unilaterally — flagged to the Owner instead of
     guessed at. A less strict `credentialless` COEP mode exists and is
     more third-party-embed-friendly, but its AdSense compatibility isn't
     something I could verify without live ad traffic to test against.
  2. **Partial, verified-safe fix shipped: `device: "gpu"` +
     `proxyToWorker: true` added to `lib/background-remover.ts`'s config.**
     Per the vendored source, `useWebGPU = config.device === "gpu" &&
     await webgpu()`, where `webgpu()` safely returns `false` if
     `navigator.gpu` is undefined or `requestAdapter()` resolves null —
     this is a strict, side-effect-free upgrade: a browser with real WebGPU
     support gets real GPU acceleration, everything else transparently
     keeps today's exact WASM/CPU behavior. Verified: `npm run build`
     clean, the existing e2e test still passes, and a real (non-headless)
     Chrome browser in this environment does resolve a working
     `navigator.gpu.requestAdapter()`. **Could not get a trustworthy
     before/after speed measurement**, though: a real-browser timing test
     (cached model, so download time excluded) still took ~22s, no faster
     than the ~20-24s baseline seen elsewhere this session on the plain
     WASM path — the test browser's WebGPU adapter reported an empty
     `info` object, which is the signature of a software-emulated adapter
     (e.g. SwiftShader) rather than real hardware acceleration, so this
     environment can't validate the real-world win. The change is kept
     because it's provably safe either way (falls back cleanly), but its
     actual benefit for real users on real GPU hardware is unverified from
     here, not overclaimed as measured.
  3. **Quality (noisy backgrounds, color-matched holes): NOT changed this
     session, flagged instead — the real tradeoff is bigger than expected.**
     The library's own built-in default is `"medium"` (`isnet_fp16`), and
     this project explicitly overrides it down to the smallest/lowest-
     quality tier, `isnet_quint8` — confirmed directly in
     `dist/index.mjs`'s schema. Fetched the CDN's real
     `resources.json` manifest for actual model sizes rather than guessing:
     **`isnet_quint8` 42.3 MB, `isnet_fp16` 84.1 MB (2x), `isnet` 168.0 MB
     (4x)**. Every user pays this download cost themselves (client-side,
     no server caching it for them) — moving even one tier up roughly
     doubles first-use download size and likely adds real inference cost
     too, working against the "very slow" complaint at the same time it
     helps the quality complaints. This is a genuine three-way product
     tradeoff (download size vs. speed vs. segmentation quality), not an
     engineering bug with one correct fix — flagged to the Owner rather
     than picked unilaterally.
  4. **The specific "holes inside a same-colored object, even separated by
     an outline" symptom is an inherent model-quality limitation, not
     something a config change fixes.** A targeted algorithmic fix is
     possible in principle — flood-fill the alpha mask from the image
     border through fully-transparent pixels (I already have working,
     fresh flood-fill code for exactly this shape of problem, from D7's
     `lib/color-segmenter.ts`) and treat any transparent region NOT
     reachable from the border as a segmentation mistake, forcing it back
     to opaque. **Deliberately not built**: that same "enclosed transparent
     region" shape also describes a *correct* result — genuine visible
     background between an arm and torso, through a subject's fingers, a
     hoop earring, glasses frames, and so on — which a border-flood-fill
     heuristic cannot tell apart from the reported artifact. Shipping it
     blind risks trading a reported bug for a probably-more-common, harder-
     to-notice regression, and there's no real diverse photo set available
     in this project to validate the heuristic against either way (only
     the single COCO demo fixture and this session's synthetic test PNGs).
     Logged here as a considered-and-rejected option, not silently skipped.

## Owner action list

- AdSense approval status for this domain is unconfirmed, same as every
  other svc-lab service — ask the Owner to check the AdSense dashboard.
- **D8 decisions needed:** (a) is trading the real-but-uncertain AdSense
  compatibility risk for faster WASM inference (via COOP/COEP headers)
  worth it, or should this wait until ads are confirmed actually rendering
  on this domain first; (b) is the ~2x/4x download-size cost of
  `isnet_fp16`/`isnet` worth the quality improvement for this tool's real
  users, or does `isnet_quint8`'s current download size matter more.

## Next steps and open questions

- `lib/object-detector.ts` always loads the `lite_mobilenet_v2` base model
  at a fixed 0.5 detect-time threshold (see D3 for why this exact value is
  load-bearing, not arbitrary), with the UI-side confidence slider
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
- `lib/color-segmenter.ts` (D7) has the same known, deliberately-deferred
  gap as `lib/object-detector.ts`: no downscale guard against a very large
  image causing excessive memory use (`imageToPixelBuffer` reads the whole
  decoded image into an RGBA buffer, and `segmentByBackgroundColor`
  allocates a few more same-sized typed arrays on top of that) — acceptable
  for a first ship of this tool, revisit together with the object-splitter's
  own version of this gap if either becomes a real problem.
- Split-by-color's `minRegionArea` noise floor and the fixed 0-40% range on
  the tolerance slider are both untuned defaults, not values verified
  against a representative sample of real icon/sprite sheets (none were
  available to test against, only the synthetic fixtures this session
  built) — revisit if real users report either missing genuinely small
  icons or picking up noise as spurious regions.
