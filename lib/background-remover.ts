// @imgly/background-removal — a browser-only library (WASM + an ONNX
// segmentation model, fetched from IMG.LY's CDN on first use and cached by
// the browser afterward). Dynamic import keeps its model download from ever
// happening on a page load that doesn't use this specific feature.
//
// API shape verified against the package's own shipped
// node_modules/@imgly/background-removal/dist/src/{api/v1,schema}.d.ts and
// dist/index.mjs source, not assumed from search results — those turned out
// to be wrong on three counts, all caught by real verification rather than
// trusted as written (see HANDOVER.md D2):
// (1) the package's root entry only re-exports `removeBackground` as a
// named export (`index.d.ts` does `export * from './api/v1'`, which per ES
// module semantics never re-exports a default binding, even though
// `api/v1.d.ts` itself does have a default export) — caught by `npm run
// build`'s TypeScript check.
// (2) `Config.model`'s real values are "isnet" | "isnet_fp16" |
// "isnet_quint8", not "small" | "medium" as search summaries claimed.
// "isnet_quint8" is the quantized (smallest, fastest) variant — the right
// tradeoff for a free tool where every user pays the model-download cost
// themselves.
// (3) passing a bare Uint8Array/ArrayBuffer does NOT work even though the
// library's own type declares it as an accepted `ImageSource` — internally
// (`imageSourceToImageData` in dist/index.mjs) it does `new Blob([image])`
// with no `type` set, then decodes purely by switching on `blob.type`
// (`imageDecode` in the same file) with no magic-byte sniffing at all. An
// untyped Blob hits that switch's default case and throws "Invalid format:
// with params: [object Object]" — a real bug in this library's byte-input
// path, caught by an actual failing Playwright e2e run against a real
// photo, not by reading the types. Worked around by requiring the caller to
// supply the real MIME type and constructing a correctly-typed Blob here.
// `device: "gpu"` requests WebGPU execution; the library's own
// `createOnnxSession` (dist/index.mjs) computes
// `useWebGPU = config.device === "gpu" && await webgpu()`, where `webgpu()`
// itself safely returns false if `navigator.gpu` is undefined or
// `requestAdapter()` resolves null — i.e. this is a strict, side-effect-free
// upgrade: browsers with WebGPU (most current Chrome/Edge, and increasingly
// Firefox/Safari) get real GPU acceleration, everything else transparently
// falls back to the exact same WASM/CPU path as before. Verified against the
// vendored source, not assumed. `proxyToWorker: true` moves inference off
// the main thread when the GPU path is active (per the same source, this
// library's `proxyToWorker` is only wired up for the WebGPU path in this
// version — harmless to set unconditionally).
export type ModelTier = "isnet_quint8" | "isnet_fp16" | "isnet";

export interface ModelTierInfo {
  model: ModelTier;
  label: string;
  description: string;
  downloadBytes: number;
}

// Real download sizes, in bytes, read directly from the CDN's own
// `resources.json` manifest for the exact pinned package version (1.7.0) —
// `curl https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/
// resources.json` and summed each model's `chunks[].offsets` deltas, not
// estimated from search results (see this file's own D2 history above for
// why that bar exists). The CDN path is version-scoped, so these stay
// correct for as long as this exact package version is installed —
// re-verify against the manifest if `@imgly/background-removal` is ever
// upgraded. `isnet_fp16` is the library's own actual default ("medium");
// this project used to default to `isnet_quint8` (its smallest/fastest,
// lowest-quality tier) unconditionally — now the user picks.
export const MODEL_TIERS: ModelTierInfo[] = [
  {
    model: "isnet_quint8",
    label: "Fast",
    description: "Smallest download, quickest processing. More prone to rough edges or gaps on busy backgrounds.",
    downloadBytes: 44_348_940,
  },
  {
    model: "isnet_fp16",
    label: "Balanced (recommended)",
    description: "The library's own default. Noticeably cleaner edges than Fast, for roughly double the download.",
    downloadBytes: 88_152_708,
  },
  {
    model: "isnet",
    label: "Best quality",
    description: "The most accurate option. A large download — best saved for a genuinely tricky photo.",
    downloadBytes: 176_149_806,
  },
];

export const DEFAULT_MODEL_TIER: ModelTier = "isnet_fp16";

const DOWNLOAD_HINT_KEY_PREFIX = "image-object-splitter:bg-model-downloaded:";
// `localStorage` writes don't fire a `storage` event in the *same* tab that
// made them (only other tabs/windows get notified) — this custom event lets
// a same-tab `useSyncExternalStore` subscriber (see the tool component)
// notice a hint changing right after a successful download, not just on the
// next mount.
const DOWNLOAD_HINT_EVENT = "image-object-splitter:model-downloaded";

// Best-effort hint, not a live cache check: there is no browser API to ask
// "is this specific cross-origin URL already in the HTTP cache" without
// actually fetching it (Cache Storage is a separate mechanism this library
// doesn't use, and `fetch(..., {cache:"only-if-cached"})` only works for
// same-origin requests, not this cross-origin CDN). What this actually
// tracks is "this browser successfully downloaded this tier before" via
// localStorage — a real, honest signal, just not a guarantee: the browser
// may have evicted its HTTP cache since. Worst case the hint is wrong and
// the user sees a real download instead of a surprise-free one.
export function hasLikelyDownloadedModel(model: ModelTier): boolean {
  try {
    return localStorage.getItem(DOWNLOAD_HINT_KEY_PREFIX + model) !== null;
  } catch {
    return false; // localStorage can throw in private-browsing/storage-blocked contexts
  }
}

// For a component to re-render when a download-hint changes, whether from
// this tab (the custom event) or another tab with the same page open (the
// native `storage` event) — meant to be passed straight to
// `useSyncExternalStore`'s `subscribe` argument.
export function subscribeToModelDownloadHints(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(DOWNLOAD_HINT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DOWNLOAD_HINT_EVENT, callback);
  };
}

function markModelDownloaded(model: ModelTier): void {
  try {
    localStorage.setItem(DOWNLOAD_HINT_KEY_PREFIX + model, String(Date.now()));
    window.dispatchEvent(new Event(DOWNLOAD_HINT_EVENT));
  } catch {
    // best-effort only — a failure here shouldn't fail the actual removal
  }
}

export interface RemovalProgress {
  phase: "downloading" | "processing";
  label: string;
  // 0..1, or null when a fraction genuinely isn't known yet (the very first
  // event for a resource, before its own total is available to compute
  // against).
  fraction: number | null;
}

// Friendly labels for the library's own `compute:*` progress keys (dist/
// index.mjs's `runInference`) — verified against source, in call order:
// decode -> inference -> mask -> encode (twice, start and end of encode).
const PROCESSING_STEP_LABELS: Record<string, string> = {
  decode: "Decoding the image…",
  inference: "Running the AI model…",
  mask: "Building the mask…",
  encode: "Encoding the result…",
};

function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export async function removeImageBackground(
  input: Uint8Array,
  mimeType: string,
  options: { model?: ModelTier; onProgress?: (progress: RemovalProgress) => void } = {},
): Promise<Uint8Array> {
  const model = options.model ?? DEFAULT_MODEL_TIER;
  const onProgress = options.onProgress;
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(new Blob([input.slice() as BlobPart], { type: mimeType }), {
    model,
    device: "gpu",
    proxyToWorker: true,
    output: { format: "image/png" },
    // The library reports progress per-resource (`fetch:<key>`, bytes so
    // far, that resource's own total), not as one global percentage — the
    // model file, the WASM runtime, and its .mjs loader each fire their own
    // sequence. Deliberately NOT blended into a single running percentage:
    // since the model download finishes well before the (much smaller) WASM
    // runtime starts, a naive sum-of-everything-seen-so-far fraction would
    // hit ~100% and then visibly drop back down once the runtime's own
    // total joins the denominator. Showing each resource's own real,
    // accurate progress under a phase-appropriate label avoids that,
    // without resorting to a fake blended number.
    progress: onProgress
      ? (key, current, total) => {
          if (key.startsWith("fetch:")) {
            const resourceKey = key.slice("fetch:".length);
            const isModel = resourceKey.includes("/models/");
            onProgress({
              phase: "downloading",
              label: isModel ? `Downloading the AI model (${formatMB(total)})…` : "Preparing the runtime…",
              fraction: total > 0 ? current / total : null,
            });
          } else if (key.startsWith("compute:")) {
            const step = key.slice("compute:".length);
            onProgress({
              phase: "processing",
              label: PROCESSING_STEP_LABELS[step] ?? "Processing…",
              fraction: total > 0 ? current / total : null,
            });
          }
        }
      : undefined,
  });
  markModelDownloaded(model);
  return new Uint8Array(await blob.arrayBuffer());
}
