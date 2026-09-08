# Domain reference — computer vision / image processing

Domain-expert review, 2026-09-08 (see HANDOVER.md D3 for the outcome
summary). WebFetch was denied this run; findings below rest on the
reviewer's WebSearch synthesis plus **primary reads of this project's own
vendored library source** (the stronger evidence, per the reviewer).

## Findings and outcomes

1. **CONFIRMED, fixed** — coco-ssd's `infer()` passes `minScore` as BOTH
   the score threshold and the IoU threshold to `nonMaxSuppression`
   (verified directly in `node_modules/@tensorflow-models/coco-ssd/dist/
   coco-ssd.js`). Detecting once at a low threshold (0.3) to "re-filter
   later" therefore changes which boxes survive suppression, not just
   which are displayed. Fixed: detection now always runs at coco-ssd's own
   documented default (0.5); the UI slider only ever raises the displayed
   threshold from there. See `app/_components/object-splitter-tool.tsx`'s
   `DETECT_MIN_SCORE` comment.
2. **CONFIRMED (reasoning), fixed** — `lib/crop-image.ts`'s
   `loadImageFromFile` revoked its object URL inside `onload`, then the
   caller reused that same (now-revoked) URL string as a *new* `<img>`
   preview element's `src`. Per spec this fails in a compliant browser (the
   blob URL registry entry is gone). Not independently re-verified in a
   live browser after the fix due to this run's session budget running out
   — flagged as a next-step below, not claimed as re-tested.
3. **CONFIRMED, fixed** — `padAndClampBox` could overflow the image bound
   by up to 1px when `round(right) - round(left)` was computed from
   independently-rounded edges. Fixed: `left`/`top`/`right`/`bottom` are
   each clamped to `[0, imageSize]` before rounding, then width/height are
   derived by subtraction of the already-bounded integers — cannot overflow.
4. **Not fixed this run (documented, deferred)** — no downscale guard
   before feeding a full-resolution photo to `fromPixels`; a 48MP phone
   photo could build a ~576MB tensor before the model's internal 300×300
   resize. Real robustness risk, not a correctness bug. Deferred to a
   future session — see HANDOVER.md's Next steps.
5. **Reasonable choice, honesty gap not fully closed** — `isnet_quint8`
   (background removal) is the vendor's own smallest/fastest variant, but
   its own README discloses "sometimes shows some artifacts," and the
   library resizes to 1024×1024 **without preserving aspect ratio** before
   inference, then writes the mask straight into alpha with no
   foreground-color decontamination — real halo/fringe risk on fine detail
   (fur, hair), worse for extreme-aspect-ratio object-splitter crops than
   for the whole-photo background remover. Not fully disclosed in the FAQ
   copy as of this commit — flagged as a next-step.
6. **Established, no action needed** — EXIF orientation: current evergreen
   browsers apply EXIF orientation consistently across `naturalWidth`,
   `drawImage`, and `createImageBitmap`, so detection and crop stay in the
   same coordinate space. Reviewer's confidence here is moderate (Firefox's
   specific behavior wasn't independently confirmed live) rather than high.
7. **Established, no action needed** — the PNG crop → optional background
   removal pipeline is lossless and correctly reasoned; the only real
   caveats (canvas color-space conversion to sRGB, EXIF metadata being
   stripped on export) are cosmetic/privacy-positive, not correctness bugs.
8. **Noted, not acted on** — coco-ssd's own weights load from
   `storage.googleapis.com` and `@imgly/background-removal`'s from
   `staticimgly.com`; the "your photo never leaves your device" claim is
   literally true (verified: no API routes, no server-side processing),
   but third-party CDN fetches for model weights do expose IP/UA/referrer
   to those services. Worth a one-line FAQ mention in a future pass.

## Next steps arising from this review

- Independently re-verify finding 2's fix in a live browser (this run's
  session budget ran out before a fresh e2e/build pass could confirm it).
- Add a downscale guard (finding 4) before detection on very large photos.
- Disclose the background-remover's fur/hair edge-quality tradeoff and the
  object-splitter's aspect-ratio-squash risk in each tool's FAQ copy
  (finding 5).
- Consider a one-line third-party-CDN disclosure (finding 8).
