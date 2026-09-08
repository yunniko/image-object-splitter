import type { Detection } from "./types";

// coco-ssd's model.detect() prediction shape (bbox: [x, y, width, height],
// class: string, score: number) — declared locally instead of importing
// the package's own type so this module's public surface doesn't leak a
// third-party type, and so the mapping in detectObjects() is explicit.
interface CocoSsdPrediction {
  bbox: [number, number, number, number];
  class: string;
  score: number;
}

interface CocoSsdModel {
  detect(
    input: HTMLImageElement | HTMLCanvasElement | ImageData,
    maxNumBoxes?: number,
    minScore?: number,
  ): Promise<CocoSsdPrediction[]>;
}

// Real total download size for coco-ssd's "lite_mobilenet_v2" base model,
// read directly from the actual hosted files (not estimated): the
// model.json topology/manifest (527,315 bytes, verified via
// `curl -sI .../model.json`'s Content-Length) plus its 5 weight shards
// (4,194,304 bytes each for the first four, 1,257,312 for the last —
// `curl -sI .../group1-shard<N>of5` on
// https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/,
// the exact URL `loadModel` below fetches via coco-ssd's own default model
// path). Re-verify against that URL if coco-ssd or its base model ever
// changes — this isn't version-pinned to a CDN path the way
// lib/background-remover.ts's MODEL_TIERS sizes are, since coco-ssd has no
// version segment in its model URL.
export const DETECTION_MODEL_SIZE_BYTES = 527_315 + 4_194_304 * 4 + 1_257_312; // 18,561,843 bytes (~17.7 MB)

const DOWNLOAD_HINT_KEY = "image-object-splitter:detection-model-downloaded";
// Same same-tab-notification reasoning as lib/background-remover.ts's
// DOWNLOAD_HINT_EVENT — `storage` events don't fire in the tab that made
// the write.
const DOWNLOAD_HINT_EVENT = "image-object-splitter:detection-model-downloaded-event";

// Same honest-hint caveat as lib/background-remover.ts's
// hasLikelyDownloadedModel: no browser API can check a cross-origin URL's
// cache status without fetching it, so this only records "this browser
// successfully downloaded the detection model before," not a live cache
// check.
export function hasLikelyDownloadedDetectionModel(): boolean {
  try {
    return localStorage.getItem(DOWNLOAD_HINT_KEY) !== null;
  } catch {
    return false; // localStorage can throw in private-browsing/storage-blocked contexts
  }
}

export function subscribeToDetectionModelDownloadHint(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(DOWNLOAD_HINT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DOWNLOAD_HINT_EVENT, callback);
  };
}

function markDetectionModelDownloaded(): void {
  try {
    localStorage.setItem(DOWNLOAD_HINT_KEY, String(Date.now()));
    window.dispatchEvent(new Event(DOWNLOAD_HINT_EVENT));
  } catch {
    // best-effort only — a failure here shouldn't fail detection itself
  }
}

export interface DetectionProgress {
  phase: "loading-model" | "detecting";
  label: string;
}

function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

// Loaded lazily and cached: both TensorFlow.js and the coco-ssd model
// weights are multi-megabyte downloads that should only happen once per
// page session, and only when the object-splitter tool is actually used
// (dynamic import keeps them out of every other page's JS bundle, including
// the background-remover tool, which doesn't need object detection at all).
let modelPromise: Promise<CocoSsdModel> | null = null;

async function loadModel(onProgress?: (progress: DetectionProgress) => void): Promise<CocoSsdModel> {
  if (!modelPromise) {
    // Only fires on the actual first load this page session — a later call
    // that reuses the already-resolved `modelPromise` never re-enters this
    // branch, so it never claims to be "downloading" something already
    // in memory. coco-ssd's own `load()` doesn't expose a byte-progress
    // hook through its public API (verified against its vendored source —
    // it calls `tf.loadGraphModel(this.modelPath)` with no options object
    // at all), so this is an honest indeterminate status, not a fake
    // percentage.
    onProgress?.({
      phase: "loading-model",
      label: `Downloading the detection model (${formatMB(DETECTION_MODEL_SIZE_BYTES)})…`,
    });
    modelPromise = (async () => {
      await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      // "lite_mobilenet_v2" is coco-ssd's smallest/fastest base model — the
      // right tradeoff for a free web tool where every user pays the model
      // download cost themselves, over the larger/more-accurate "mobilenet_v2".
      const model = (await cocoSsd.load({ base: "lite_mobilenet_v2" })) as CocoSsdModel;
      markDetectionModelDownloaded();
      return model;
    })();
  }
  return modelPromise;
}

export async function detectObjects(
  image: HTMLImageElement,
  minScore = 0.5,
  onProgress?: (progress: DetectionProgress) => void,
): Promise<Detection[]> {
  const model = await loadModel(onProgress);
  onProgress?.({ phase: "detecting", label: "Detecting objects…" });
  const predictions = await model.detect(image, 20, minScore);
  return predictions.map((p) => ({
    className: p.class,
    score: p.score,
    bbox: { x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] },
  }));
}
