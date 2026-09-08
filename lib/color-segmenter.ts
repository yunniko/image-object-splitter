import type { BoundingBox, PixelBuffer, RGB } from "./types";

// Straight-line RGB distance. Not perceptual (no CIE Lab/ΔE weighting) — a
// deliberate simplicity tradeoff for a client-side tool with no dependency
// budget for a full color-science library; documented here rather than
// silently presented as more accurate than it is (see the "How accurate is
// the color matching?" FAQ answer on the tool's own page).
function colorDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// The largest possible distance between two RGB colors (black vs. white) —
// used to convert a user-facing 0-100 "tolerance" percentage into the raw
// distance colorDistance() works in.
export const MAX_COLOR_DISTANCE = Math.sqrt(3 * 255 * 255);

export function tolerancePercentToDistance(percent: number): number {
  return (Math.max(0, Math.min(100, percent)) / 100) * MAX_COLOR_DISTANCE;
}

function samplePixel(pixels: PixelBuffer, x: number, y: number): RGB {
  const o = (y * pixels.width + x) * 4;
  return { r: pixels.data[o], g: pixels.data[o + 1], b: pixels.data[o + 2] };
}

const CORNER_GROUP_TOLERANCE = 24;

function averageColor(colors: RGB[]): RGB {
  const sum = colors.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });
  return {
    r: Math.round(sum.r / colors.length),
    g: Math.round(sum.g / colors.length),
    b: Math.round(sum.b / colors.length),
  };
}

// Guesses the background color from the image's four corners rather than
// requiring the user to pick it manually first — the common case for a
// sprite/icon sheet or a product photo on a seamless background is that
// every corner IS the background. Corners are grouped by mutual closeness
// (tolerating anti-aliasing/JPEG noise) and the largest group's average is
// returned, so a single corner touched by content (e.g. an icon flush
// against one edge) doesn't throw off the result as long as the other three
// corners still agree.
export function detectBackgroundColor(pixels: PixelBuffer): RGB {
  const corners = [
    samplePixel(pixels, 0, 0),
    samplePixel(pixels, pixels.width - 1, 0),
    samplePixel(pixels, 0, pixels.height - 1),
    samplePixel(pixels, pixels.width - 1, pixels.height - 1),
  ];
  const groups: RGB[][] = [];
  for (const corner of corners) {
    const group = groups.find((g) => colorDistance(g[0], corner) <= CORNER_GROUP_TOLERANCE);
    if (group) group.push(corner);
    else groups.push([corner]);
  }
  groups.sort((a, b) => b.length - a.length);
  return averageColor(groups[0]);
}

export interface SegmentOptions {
  background: RGB;
  // Raw RGB-distance threshold (see tolerancePercentToDistance) — a pixel
  // within this distance of `background` is treated as background, not
  // content.
  colorTolerance: number;
  // Connected components smaller than this pixel count are dropped as
  // noise (a stray JPEG artifact or a single mis-tolerant pixel isn't a
  // "detection"). Defaults to a size that scales with the image itself
  // rather than a fixed pixel count, so the same default behaves sanely
  // on both a tiny icon sheet and a large one.
  minRegionArea?: number;
}

const NEIGHBORS_8: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

// Finds every connected region of non-background pixels and returns its
// bounding box, sorted reading-order (top-to-bottom, then left-to-right)
// for a stable, predictable UI list. This is plain flood-fill / connected-
// component labeling over a background/foreground mask — a well-established
// technique for "cut apart a sprite sheet," deliberately not an ML model:
// the background color is already known exactly, so a deterministic pixel
// classification is both simpler and more precise than a learned detector
// trained on real-world photo classes (see docs/domain-reference.md... this
// project's coco-ssd detector) would be for this different kind of image.
//
// Iterative BFS (not recursion) so a large foreground region can't blow the
// call stack; 8-connectivity so a single diagonal-adjacent seam of pixels
// (common at a shape's anti-aliased corner) doesn't get split into two
// separate regions.
export function segmentByBackgroundColor(pixels: PixelBuffer, options: SegmentOptions): BoundingBox[] {
  const { width, height, data } = pixels;
  const { background, colorTolerance } = options;
  const pixelCount = width * height;
  const minRegionArea = options.minRegionArea ?? Math.max(9, Math.round(pixelCount * 0.0005));

  const isBackground = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const alpha = data[o + 3];
    const pixel = { r: data[o], g: data[o + 1], b: data[o + 2] };
    // A fully transparent pixel (e.g. this same tool's own transparent
    // export, re-uploaded) is background regardless of its RGB — there's
    // nothing there to be "close" to.
    isBackground[i] = alpha === 0 || colorDistance(pixel, background) <= colorTolerance ? 1 : 0;
  }

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const boxes: BoundingBox[] = [];

  for (let start = 0; start < pixelCount; start++) {
    if (isBackground[start] || visited[start]) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;

    let minX = start % width;
    let maxX = minX;
    let minY = Math.floor(start / width);
    let maxY = minY;
    let area = 0;

    while (head < tail) {
      const idx = queue[head++];
      area++;
      const x = idx % width;
      const y = (idx - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (const [dx, dy] of NEIGHBORS_8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx] || isBackground[nIdx]) continue;
        visited[nIdx] = 1;
        queue[tail++] = nIdx;
      }
    }

    if (area >= minRegionArea) {
      boxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
    }
  }

  return boxes.sort((a, b) => a.y - b.y || a.x - b.x);
}

// Returns a copy of `pixels` with every background-colored pixel's alpha set
// to 0 — a color-keyed cutout. Pure (never mutates the input), same
// reasoning as the rest of this module: the exact background color is
// already known, so this is a precise, instant alternative to running the
// ML background remover (lib/background-remover.ts) for this specific case,
// not a replacement for it on an arbitrary photo.
export function keyOutBackground(pixels: PixelBuffer, background: RGB, colorTolerance: number): PixelBuffer {
  const data = new Uint8ClampedArray(pixels.data);
  for (let o = 0; o < data.length; o += 4) {
    const pixel = { r: data[o], g: data[o + 1], b: data[o + 2] };
    if (colorDistance(pixel, background) <= colorTolerance) {
      data[o + 3] = 0;
    }
  }
  return { data, width: pixels.width, height: pixels.height };
}

export function rgbToHex(color: RGB): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function hexToRgb(hex: string): RGB {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!match) throw new Error(`"${hex}" is not a valid #rrggbb color.`);
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}
