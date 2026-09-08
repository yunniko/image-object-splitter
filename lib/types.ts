// A bounding box in image pixel coordinates. x/y is the top-left corner, and
// width/height are always >= 0 — matches the shape TensorFlow.js's coco-ssd
// model returns from `model.detect()` (bbox: [x, y, width, height]).
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

// One detected object. className/score come straight from coco-ssd's own
// 80 COCO classes and its own confidence score (0..1) — this project does
// not re-score or re-classify anything itself.
export interface Detection {
  className: string;
  score: number;
  bbox: BoundingBox;
}
