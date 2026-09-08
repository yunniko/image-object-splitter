// Downloads the test fixture used by tests/e2e specs. Not committed to git
// (see .gitignore) — see HANDOVER.md's testing-strategy decision record for
// why: it's a real Flickr-sourced photo redistributed by the official COCO
// dataset server for exactly this kind of demo/test use, but its per-image
// Flickr license isn't individually verified, so it's fetched on demand
// into a gitignored path rather than committed to this project's public repo.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FIXTURE_URL = "http://images.cocodataset.org/val2017/000000039769.jpg";
const OUT_DIR = path.join(import.meta.dirname, "..", "tests", "e2e", "fixtures");
const OUT_FILE = path.join(OUT_DIR, "two-cats.jpg");

const res = await fetch(FIXTURE_URL);
if (!res.ok) {
  throw new Error(`Failed to fetch test fixture: HTTP ${res.status}`);
}
const bytes = new Uint8Array(await res.arrayBuffer());
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, bytes);
console.log(`Wrote ${OUT_FILE} (${bytes.length} bytes)`);
