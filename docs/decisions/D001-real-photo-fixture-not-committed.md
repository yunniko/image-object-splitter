# D001 · The e2e fixture is a real COCO photo, fetched on demand, never committed
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Real detection needs a real photograph; the COCO "two cats" image is the field's standard demo image, but its Flickr CC licence wasn't individually verified and the repo is public.
Decision: `scripts/fetch-test-fixtures.mjs` downloads it into gitignored `tests/e2e/fixtures/`; specs throw a clear error naming the command if it's missing.
Rejected: committing the photo; mocking the model (would never verify the real pipeline).
Consequence: Run `npm run fetch-test-fixtures` before e2e.
Evidence: `scripts/fetch-test-fixtures.mjs`.
