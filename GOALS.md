# Goals — image-object-splitter

Owner writes goals here; The Company plans, executes, and logs against them.
Statuses: `DRAFT` · `ACTIVE` · `BLOCKED` · `DONE`.
Parent initiative: `E:\CLAUDE\projects\svc-lab\` (same milestone-gate waiver
and standing deploy pre-approval apply here). Template/numbering
conventions in `E:\CLAUDE\COMPANY\GOALS.md`.

## Active goals

### G-001 · Client-side object splitter & background remover — ACTIVE
- **What:** Two tools: an object splitter (`/object-splitter`) that detects
  the distinct objects in an uploaded photo using TensorFlow.js + coco-ssd
  and exports each selected one as its own PNG (optionally with the
  background removed), and a standalone background remover
  (`/background-remover`) using `@imgly/background-removal`. Both run
  entirely client-side — no server-side image processing, no uploads.
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
- [ ] M3 — Security review, then ship (git init, `init-repo.ps1`,
      `deploy-service.ps1`, hub-page/sitemap-index update, SEO review).
- [ ] M4 — Monetization once AdSense approves this domain (blocked on the
      Owner/Google, same as every other svc-lab service — already wired
      via the shared `ADSENSE_PUBLISHER_ID` env var).

**Progress log** (newest first):
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
