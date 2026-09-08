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

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// A decoded image's raw pixel data, RGBA, row-major, 4 bytes per pixel —
// the same shape as the DOM's ImageData but declared independently so the
// color-segmentation algorithm in lib/color-segmenter.ts stays testable
// with a plain in-memory object and doesn't require a real ImageData
// instance (which only exists in a browser/canvas context).
export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
