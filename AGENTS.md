<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# image-object-splitter — project conventions

Read `HANDOVER.md` first: current state, decision record (especially D1's
test-fixture licensing rationale and D2's three real `@imgly/
background-removal` integration bugs), next steps. Goal in `GOALS.md`
(G-001). Parent initiative in `E:\CLAUDE\projects\svc-lab\`; company-wide
standards in `E:\CLAUDE\COMPANY\`.

- Stack: Next.js App Router, TypeScript, Tailwind. No database, no auth, no
  accounts. Detection (TensorFlow.js + coco-ssd), cropping (canvas), and
  background removal (`@imgly/background-removal`) all run client-side —
  no API routes, nothing is ever sent to a server. Keep it that way; this
  project's entire privacy pitch depends on it being literally true.
- `lib/object-detector.ts` and `lib/background-remover.ts` both dynamically
  `import()` their heavy ML dependencies rather than importing them at the
  top of the file — this keeps a multi-megabyte model/runtime out of every
  page's JS bundle except the one page that actually uses it. Don't change
  these to static imports even if it looks simpler.
- `lib/background-remover.ts`'s `removeImageBackground` requires an
  explicit MIME type argument — do not "simplify" this back to a bare
  `Uint8Array`/`ArrayBuffer` call. See HANDOVER.md D2 point 3: the
  underlying library silently fails to decode an untyped `Blob`, and this
  isn't caught by TypeScript (the library's own types claim raw bytes are
  fine) — only a real e2e run against a real photo caught it.
- `lib/geometry.ts`'s `padAndClampBox` is the only place crop coordinates
  get computed — always clamps to the source image's actual bounds. Don't
  add a second box-math implementation elsewhere; route any new export
  format through this function.
- `npm install`/`npm ci` need `--legacy-peer-deps` (a live npm/arborist
  bug, not specific to this project — see `svc-lab/HANDOVER.md`).
- Two test layers: `npx vitest run` (unit — pure crop/zip logic only, no
  ML) and `npx playwright test` (e2e — real on-device model inference
  against a real photo fixture; run `npm run fetch-test-fixtures` first,
  see D1). The e2e suite is slower than a typical svc-lab service's because
  it downloads and runs real AI models inside the browser — this is
  expected, not a hang. Also run `npm run build` before calling any change
  to the ML wrapper modules done — it's the only layer that catches a
  wrong third-party export name or config shape (see D2).
- See `E:\CLAUDE\COMPANY\INFRASTRUCTURE_DEPLOY.md` for the redeploy
  command once live.
