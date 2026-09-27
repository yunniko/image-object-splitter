# D011 · The object detector discloses its 18 MB download, status, and "downloaded before"
Date: 2026-09-09 · Goal: G-001 · Status: active
Context: Owner: no silent traffic anywhere. coco-ssd's `load()` has no progress hook.
Decision: `DETECTION_MODEL_SIZE_BYTES` = 18,561,843 (manifest plus 5 weight shards, verified with curl; shard paths carry no extension), a localStorage hint, phase labels with an indeterminate progress bar; the object-splitter's "remove background" checkbox shows the default tier's size; split-by-color has no model. A stale "a few megabytes" FAQ line was fixed.
Rejected: a fake numeric bar via pre-fetching.
Consequence: Re-verify the model URL if coco-ssd or its base model changes.
Evidence: `lib/object-detector.ts`.
