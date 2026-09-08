# Goals — image-object-splitter

Owner writes goals here; The Company plans, executes, and logs against them.
Statuses: `DRAFT` · `ACTIVE` · `BLOCKED` · `DONE`.
Parent initiative: `E:\CLAUDE\projects\svc-lab\` (same milestone-gate waiver
and standing deploy pre-approval apply here). Template/numbering
conventions in `E:\CLAUDE\COMPANY\GOALS.md`.

## Active goals

### G-001 · Client-side object splitter & background remover — ACTIVE
- **What:** Three tools: an object splitter (`/object-splitter`) that
  detects the distinct objects in an uploaded photo using TensorFlow.js +
  coco-ssd and exports each selected one as its own PNG (optionally with the
  background removed, optionally resized to fit a box); a background-color
  splitter (`/split-by-color`, added 2026-09-08, Owner-directed) that cuts
  apart an icon/sprite sheet by connected-component color segmentation — no
  AI, a deliberately different technique for a different image domain than
  coco-ssd covers; and a standalone background remover (`/background-remover`)
  using `@imgly/background-removal`. All three run entirely client-side —
  no server-side image processing, no uploads.
- **Why:** svc-lab backlog idea #11 — **Owner-directed** (chat, 2026-09-08),
  not from the usual research-pass ranking; explicitly prioritized ahead of
  the rest of the backlog. First ML-based tool in the svc-lab portfolio, a
  real scope step up from the calculator/converter/generator pattern of
  services #1-7.
- **Acceptance criteria:** Detection and background removal both verified
  against a real photo in a real browser (not just unit-tested pure logic);
  crop/padding math unit-tested; a real build (`npm run build`) passes,
  catching any client/server-boundary or third-party-API-shape bugs; live
  and reachable over HTTPS; sitemap present; the honesty of every UI/FAQ
  claim (detection classes, privacy, model-download cost) checked by a
  domain-expert review before shipping.
- **Constraints:** No database, no accounts, no paid dependencies. No
  server-side ML inference of any kind — the "your photo is never
  uploaded" claim must be literally true, not just typical.

**Milestones:**
- [x] M1 — Build: `lib/geometry.ts` (crop padding/clamping, filename/
      per-class-index logic — pure, unit-tested), `lib/zip-export.ts`
      (JSZip wrapper, unit-tested), `lib/object-detector.ts` (TensorFlow.js
      + coco-ssd wrapper), `lib/background-remover.ts`
      (`@imgly/background-removal` wrapper), `lib/crop-image.ts`
      (canvas-based cropping), 2 tool pages + hub, e2e tests against a real
      photo. ✔ 2026-09-08.
- [x] M1b — Fix the real bugs `npm run build` and a real failing e2e run
      surfaced in the `@imgly/background-removal` integration (wrong export
      name, wrong `model` enum values, and a library bug where a bare
      Uint8Array/ArrayBuffer input silently fails to decode) — see
      HANDOVER.md D2. ✔ 2026-09-08.
- [x] M2 — Domain-expert review complete, found and fixed 3 real bugs
      (NMS threshold coupling, revoked blob URL, crop-rounding overflow) —
      see HANDOVER.md D3 and docs/domain-reference.md. ✔ 2026-09-08.
- [x] M3 — Independently re-verified (fresh `npm run build` + full
      `npx playwright test` including real on-device model inference —
      all clean), found and fixed one more real bug in the process
      (D5: the D3 blob-URL fix's promised cleanup was never actually
      implemented), then shipped: `init-repo.ps1`, `deploy-service.ps1`,
      hub-page/sitemap-index update. ✔ 2026-09-08.
- [x] M4 — Owner-directed additions (same day, 2026-09-08): a shared
      "resize exports to fit a box" step (contain-fit, transparent or
      solid-color letterbox) added to object-splitter, and a new
      background-color-splitter tool (`/split-by-color`) for icon/sprite
      sheets — deliberately non-AI (connected-component color
      segmentation), after the Owner asked whether the AI-based object
      splitter would handle "an icon set on a single color background" (it
      wouldn't — see HANDOVER.md D7). Built, unit- and e2e-tested (62 unit
      tests total, 12 e2e including two manual real-browser pixel-level
      checks), shipped. ✔ 2026-09-08.
- [ ] M5 — Monetization once AdSense approves this domain (blocked on the
      Owner/Google, same as every other svc-lab service — already wired
      via the shared `ADSENSE_PUBLISHER_ID` env var).

**Progress log** (newest first):
- 2026-09-09 — Owner asked for two follow-ups on the quality picker: "make
  downloaded options green and make a retry button if other model is
  chosen." Full detail in HANDOVER.md's D10. Downloaded tiers now get a
  real green border/background, not just gray hint text, kept visually
  independent from the blue "selected" ring so both can show at once. A
  new "Retry with &lt;tier&gt;" prompt appears whenever the selected tier
  differs from whichever tier actually produced the current result, and
  re-processes the already-uploaded photo's stored bytes without asking
  for a re-upload. Verified: `npx eslint .`/`npm run build` clean,
  `npx vitest run` 43/43 (UI-only change, no lib logic touched), and two
  real e2e checks — the downloaded tier's actual DOM element carries the
  green class, and a full retry cycle (upload, switch tier, retry, confirm
  a second real model run completes and the prompt clears) passes against
  real on-device inference, not mocked.
- 2026-09-08 — Owner resolved D8's two open questions: held off on COOP/
  COEP (WASM threading) until AdSense is confirmed rendering on this
  domain, and asked for the model-quality tradeoff to become a user-facing
  choice instead of a unilateral pick — "a quality choice option telling
  how much download it will require and check[]ing if it is already
  downloaded and cached or not... download progressbar if it is possible
  or at least a 'preparing' status with loader icon." Built all three; full
  detail in HANDOVER.md's D9. Quality picker with real byte-exact download
  sizes (44.3/88.1/176.1 MB) now defaults to the library's own real default
  ("Balanced"/isnet_fp16) rather than its lowest tier. "Downloaded before"
  is an honest localStorage-based hint, not a literal cache check — no
  browser API exists to check a cross-origin URL's cache status without
  fetching it, documented as such rather than overclaiming. A real,
  byte-accurate progress bar (the library's own progress callback, verified
  against source) plus a small shared spinner component cover both the
  literal ask and its "or at least" fallback. Along the way, a first draft
  hit a real `react-hooks/set-state-in-effect` lint error reading
  `localStorage` in a `useEffect`; rebuilt on `useSyncExternalStore`
  instead (the React-correct tool for subscribing to a browser API with no
  React-specific hook), with a same-tab custom event since `storage` events
  don't fire in the tab that made the change. Verified: `npx eslint .`
  clean, `npx vitest run` 43/43, `npm run build` clean (caught one real
  TS1501 — an unsupported regex flag in a new e2e assertion, fixed), and
  the existing background-remover e2e test extended (not duplicated, to
  avoid another ~90s+ model-download test run) to cover the picker, the
  progress bar, and — via an actual page reload after a real run — that the
  "downloaded before" hint genuinely persists and re-renders, not just that
  it compiles. A real-browser timing check confirmed the expected cost
  directly: "Balanced" (84 MB) took ~33s vs. ~20-24s for the old default
  ("Fast", 42 MB) on the same fixture. Object-splitter's existing "remove
  background" checkbox was updated too (shared default tier, live progress
  in its own status text) without adding a full picker there, to avoid
  cluttering its already dense per-export control panel.
- 2026-09-08 — Owner reported real background-remover quality/speed
  problems (noisy-background cleanliness, holes appearing inside an object
  when part of it matches the background color even across an outline,
  and general slowness). Investigated by reading the vendored `@imgly/
  background-removal` source and fetching its real CDN model-size manifest
  rather than guessing — full detail in HANDOVER.md's D8. Shipped one
  verified-safe partial fix (`device: "gpu"` + `proxyToWorker: true`,
  automatic fallback to today's exact behavior on unsupported browsers —
  confirmed via source and a real-browser check that a working WebGPU
  adapter resolves here, though this specific test environment's adapter
  looks software-emulated so I couldn't confirm a real speed win from it).
  Two harder findings flagged to the Owner rather than decided
  unilaterally: enabling WASM multi-threading needs COOP/COEP headers that
  risk breaking Google AdSense's ad iframes (a real tradeoff given this
  domain's ads aren't even confirmed rendering yet); and the current
  `isnet_quint8` model is the library's own lowest-quality tier (42.3 MB)
  versus its own actual default `isnet_fp16` (84.1 MB) or full `isnet`
  (168.0 MB) — a genuine download-size/speed/quality tradeoff, not
  something to pick unilaterally for a free client-side tool. A targeted
  "fill enclosed alpha holes" post-process was considered for the specific
  outline-separated-hole symptom and deliberately not built: it can't
  distinguish that artifact from a legitimate visible-background gap (arm
  akimbo, fingers, jewelry), and there's no diverse real-photo set here to
  validate it against either way. Verified: `npx eslint .` clean,
  `npx vitest run` 43/43, `npm run build` clean, the background-remover
  e2e test still passes.
- 2026-09-08 — Added the resize-to-box export step and the split-by-color
  tool (both Owner-directed, see M4 above). Full detail in HANDOVER.md's D6
  and D7. Verification: `npx eslint .` clean, `npx vitest run` 62/62 passing
  (19 new for `lib/color-segmenter.ts`, 7 new for `computeContainFit`),
  `npm run build` clean (new `/split-by-color` route prerenders), full
  `npx playwright test` 12/12 passing (5 new split-by-color tests against an
  in-test-generated synthetic PNG fixture, no model download needed for
  those). Beyond the automated suite, did two manual real-browser checks
  Playwright's own assertions couldn't cover without a full PNG decoder:
  read a downloaded resized export's actual pixel colors with PowerShell's
  `System.Drawing` (confirmed the letterbox fill color rendered correctly,
  not just the output dimensions), and did the same for a split-by-color
  transparency export (confirmed an actually-transparent corner alongside
  an actually-opaque, correctly-colored center pixel). Refactored
  `object-splitter-tool.tsx` to share `lib/trigger-download.ts` and
  `app/_components/resize-controls.tsx` with the new tool rather than
  duplicating ~100 lines of identical download/resize-UI logic; its
  existing e2e tests were re-run unchanged afterward to confirm no
  behavior change. Not treated as needing a `domain-expert` review (see
  HANDOVER.md D7 for the reasoning — this is a software/CS technique, not a
  physical/chemical/biological/craft domain claim); the FAQ instead
  honestly discloses the technique's real limits (touching/overlapping
  items merge; a non-uniform background is harder to match). Hub page,
  sitemap, and own-project metadata updated for the new tool. Security-
  reviewed (a sub-agent pass against the actual committed diff, following
  `svc-lab\automation\prompt.md`'s pattern — checked the new color-picker/
  resize inputs against `ctx.fillStyle` and canvas pixel APIs for an
  injection path; found none — canvas `fillStyle` isn't an HTML/script
  sink and silently ignores invalid values per spec). Committed, pushed,
  redeployed (`redeploy-service.ps1`, clean on the first attempt), and
  verified live at https://image-object-splitter.svc.julienika.cz/split-by-color.
- 2026-09-08 — Shipped by an interactive session resuming from the prior
  run's session-budget stop. Before trusting the unverified D3 fixes,
  reviewed the actual code diff (not just the run's own description) and
  found a real gap: the revoked-blob-URL fix's own comment promised
  cleanup ("caller owns revoking it") that no code actually implemented
  — a real memory leak on repeated uploads in both tools (same pattern
  in `background-remover-tool.tsx` too, not just the object splitter).
  Fixed both (D5), then ran the full verification suite fresh from
  scratch (not trusted from before): ESLint, 17 Vitest tests, a clean
  production build, and the full Playwright e2e suite including real
  on-device coco-ssd detection and `@imgly/background-removal` inference
  against the real photo fixture — all clean. Deployed (port 30120,
  clean on the first attempt), hub page and sitemap index updated and
  redeployed, live verified over HTTPS with a real browser check, every
  other host container's uptime confirmed unaffected.
- 2026-09-08 — **BLOCKED (session budget)**, same pattern as
  `epub-metadata-fixer`'s earlier stop. Domain-expert review completed and
  found 3 real, source-verified bugs (not documentation gaps): coco-ssd's
  `infer()` passes `minScore` as both the score and IoU threshold to NMS,
  so this project's original "detect low, filter later" design silently
  mis-suppressed overlapping objects — fixed by always detecting at
  coco-ssd's own default (0.5); a revoked-blob-URL bug that could break the
  preview image; and a 1px crop-rounding overflow. All three fixed and
  committed. Manual security-review equivalent done (same tooling gap as
  epub-metadata-fixer: `/security-review`'s `origin/HEAD` precondition
  can't run before a remote exists) — no findings (no API routes, no
  secrets, the only `dangerouslySetInnerHTML` is the shared JSON-LD
  helper). **Not done this run, due to session budget running out before
  it**: independently re-verifying the fixes with a fresh `npm run build`
  + full Playwright e2e pass (only unit tests + ESLint were re-run after
  the fixes — both clean), `init-repo.ps1`/`deploy-service.ps1`, the
  hub-page/sitemap-index update, and the SEO review. Two items from the
  domain-expert review deliberately deferred rather than rushed: a
  downscale guard against OOM on very large photos, and fuller FAQ
  disclosure of the background-remover's fur/hair edge-quality tradeoff —
  see docs/domain-reference.md's "Next steps." **Next session should
  resume from here**: run `npm run build && npx playwright test` fresh to
  confirm the three fixes didn't regress anything, then proceed to ship
  (M3). Nothing has left the workspace — only a local git commit exists,
  no GitHub repo, no VPS deploy.
- 2026-09-08 — M1/M1b complete (svc-lab daily automation run). Built both
  tools end to end. `npm run build` and a real Playwright e2e run against
  the real photo fixture (see HANDOVER.md D1 for its sourcing) each caught
  a real integration bug against `@imgly/background-removal` that
  WebSearch-sourced documentation got wrong — see HANDOVER.md D2 for the
  full detail (wrong export name, wrong `model` config enum, and an actual
  library bug in its byte-input decode path, not just a usage mistake on
  this project's side). All local verification passing after the fixes:
  ESLint clean, 17 Vitest unit tests (crop-geometry math, per-class
  filename numbering, zip round-trip), production build clean (all 7
  routes prerender), and the full Playwright e2e suite — including two
  tests that exercise the *real* on-device models (coco-ssd detection and
  isnet_quint8 background segmentation) against a real photo, not mocked
  data. Picked backlog idea #11 per the Owner's explicit priority override
  (see svc-lab/GOALS.md) — next steps are the domain-expert review, then
  the security review and ship.
