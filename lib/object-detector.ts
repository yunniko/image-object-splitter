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

// Loaded lazily and cached: both TensorFlow.js and the coco-ssd model
// weights are multi-megabyte downloads that should only happen once per
// page session, and only when the object-splitter tool is actually used
// (dynamic import keeps them out of every other page's JS bundle, including
// the background-remover tool, which doesn't need object detection at all).
let modelPromise: Promise<CocoSsdModel> | null = null;

async function loadModel(): Promise<CocoSsdModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      // "lite_mobilenet_v2" is coco-ssd's smallest/fastest base model — the
      // right tradeoff for a free web tool where every user pays the model
      // download cost themselves, over the larger/more-accurate "mobilenet_v2".
      return cocoSsd.load({ base: "lite_mobilenet_v2" }) as Promise<CocoSsdModel>;
    })();
  }
  return modelPromise;
}

export async function detectObjects(
  image: HTMLImageElement,
  minScore = 0.5,
): Promise<Detection[]> {
  const model = await loadModel();
  const predictions = await model.detect(image, 20, minScore);
  return predictions.map((p) => ({
    className: p.class,
    score: p.score,
    bbox: { x: p.bbox[0], y: p.bbox[1], width: p.bbox[2], height: p.bbox[3] },
  }));
}
