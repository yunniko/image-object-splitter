import type { BoundingBox, Detection, ImageSize } from "./types";

// Expands a box by `paddingRatio` of its own width/height on every side, then
// clamps the result to the image bounds and rounds to whole pixels — a crop
// exported from this box must never read outside the source image's actual
// pixel data (drawImage/getImageData would otherwise silently produce
// transparent/black padding instead of throwing, which would look like a
// bug in the exported file rather than fail loudly).
export function padAndClampBox(
  box: BoundingBox,
  paddingRatio: number,
  imageSize: ImageSize,
): BoundingBox {
  if (paddingRatio < 0) {
    throw new Error("paddingRatio must be >= 0");
  }
  const padX = box.width * paddingRatio;
  const padY = box.height * paddingRatio;

  const left = Math.round(Math.max(0, box.x - padX));
  const top = Math.round(Math.max(0, box.y - padY));
  // Rounded independently from `left`/`top`, not derived as
  // round(right) - round(left) from separately-rounded edges — rounding
  // each edge and then subtracting can overshoot the image bound by up to
  // 1px (e.g. left=k+0.5 rounds up to k+1 while right stays at the clamped
  // edge), which the function's own contract above says must never happen.
  const right = Math.min(imageSize.width, Math.round(box.x + box.width + padX));
  const bottom = Math.min(imageSize.height, Math.round(box.y + box.height + padY));

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

export function boxArea(box: BoundingBox): number {
  return box.width * box.height;
}

// coco-ssd's own `minScore` detect() parameter already filters at the model
// level, but the UI also lets a user raise the confidence threshold after
// the fact (re-filtering already-computed detections is instant; re-running
// the model isn't) — this is that second, client-side filter.
export function filterByScore(detections: Detection[], minScore: number): Detection[] {
  return detections.filter((d) => d.score >= minScore);
}

// Sorts highest-confidence first, purely for a stable, predictable UI list
// order — coco-ssd does not guarantee its own output order.
export function sortByScoreDescending(detections: Detection[]): Detection[] {
  return [...detections].sort((a, b) => b.score - a.score);
}

const FILENAME_UNSAFE = /[^a-z0-9-]+/g;

// "sports ball" -> "sports-ball"; strips anything that isn't a lowercase
// letter/digit/hyphen so the result is always a safe filename component
// across Windows/macOS/Linux and every browser's download-attribute
// handling, regardless of what a future coco-ssd class list contains.
export function slugifyClassName(className: string): string {
  const slug = className
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(FILENAME_UNSAFE, "");
  return slug.length > 0 ? slug : "object";
}

// Builds "cat-1.png", "cat-2.png", ... — `index` is the 1-based position of
// this detection among same-class detections, not the overall list index,
// so exporting 3 cats and 1 dog yields cat-1/cat-2/cat-3/dog-1, not
// cat-1/cat-4 with gaps.
export function buildExportFilename(className: string, index: number, ext: string): string {
  return `${slugifyClassName(className)}-${index}.${ext}`;
}

// Assigns each detection a 1-based per-class index in list order, e.g.
// [cat, dog, cat] -> [1, 1, 2]. Kept separate from buildExportFilename so
// filename formatting and per-class numbering can be tested independently.
export function assignPerClassIndices(detections: Detection[]): number[] {
  const counts = new Map<string, number>();
  return detections.map((d) => {
    const next = (counts.get(d.className) ?? 0) + 1;
    counts.set(d.className, next);
    return next;
  });
}
