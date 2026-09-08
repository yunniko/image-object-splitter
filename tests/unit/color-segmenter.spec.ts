import { describe, expect, it } from "vitest";
import {
  detectBackgroundColor,
  hexToRgb,
  keyOutBackground,
  rgbToHex,
  segmentByBackgroundColor,
  tolerancePercentToDistance,
} from "@/lib/color-segmenter";
import type { PixelBuffer, RGB } from "@/lib/types";

// Builds a PixelBuffer (RGBA, row-major) painting `background` everywhere
// except the given rectangles, which get their own solid color — the same
// shape segmentByBackgroundColor expects, without needing a real canvas.
function makeBuffer(width: number, height: number, background: RGB, rects: { x: number; y: number; width: number; height: number; color: RGB; alpha?: number }[]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = background;
      let alpha = 255;
      for (const rect of rects) {
        if (x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height) {
          color = rect.color;
          alpha = rect.alpha ?? 255;
          break;
        }
      }
      const o = (y * width + x) * 4;
      data[o] = color.r;
      data[o + 1] = color.g;
      data[o + 2] = color.b;
      data[o + 3] = alpha;
    }
  }
  return { data, width, height };
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const RED: RGB = { r: 255, g: 0, b: 0 };
const GREEN: RGB = { r: 0, g: 255, b: 0 };

describe("segmentByBackgroundColor", () => {
  it("finds two disconnected squares and returns their exact bounding boxes", () => {
    const pixels = makeBuffer(100, 50, WHITE, [
      { x: 10, y: 10, width: 20, height: 20, color: RED },
      { x: 60, y: 5, width: 15, height: 15, color: GREEN },
    ]);
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 10 });
    // Reading order (top-to-bottom, then left-to-right): the green square's
    // y=5 sorts before the red square's y=10, even though red was listed
    // first above.
    expect(boxes).toEqual([
      { x: 60, y: 5, width: 15, height: 15 },
      { x: 10, y: 10, width: 20, height: 20 },
    ]);
  });

  it("orders regions reading-order: top-to-bottom, then left-to-right", () => {
    const pixels = makeBuffer(100, 100, WHITE, [
      { x: 60, y: 60, width: 10, height: 10, color: RED }, // bottom-right -> last
      { x: 5, y: 5, width: 10, height: 10, color: RED }, // top-left -> first
      { x: 5, y: 60, width: 10, height: 10, color: RED }, // bottom-left -> middle
    ]);
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 10, minRegionArea: 1 });
    expect(boxes.map((b) => `${b.x},${b.y}`)).toEqual(["5,5", "5,60", "60,60"]);
  });

  it("merges two touching shapes into a single region", () => {
    const pixels = makeBuffer(100, 50, WHITE, [
      { x: 10, y: 10, width: 20, height: 20, color: RED },
      // Directly adjacent to the box above (starts exactly where it ends) —
      // must be treated as one connected region, not two.
      { x: 30, y: 10, width: 20, height: 20, color: GREEN },
    ]);
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 10 });
    expect(boxes).toEqual([{ x: 10, y: 10, width: 40, height: 20 }]);
  });

  it("connects a shape through a diagonal (8-connectivity) seam", () => {
    const pixels = makeBuffer(20, 20, WHITE, [
      { x: 5, y: 5, width: 1, height: 1, color: RED },
      { x: 6, y: 6, width: 1, height: 1, color: RED }, // only diagonally adjacent
    ]);
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 10, minRegionArea: 1 });
    expect(boxes).toEqual([{ x: 5, y: 5, width: 2, height: 2 }]);
  });

  it("drops a region smaller than minRegionArea as noise", () => {
    const pixels = makeBuffer(50, 50, WHITE, [{ x: 5, y: 5, width: 2, height: 2, color: RED }]); // area 4
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 10, minRegionArea: 10 });
    expect(boxes).toEqual([]);
  });

  it("keeps a region at or above minRegionArea", () => {
    const pixels = makeBuffer(50, 50, WHITE, [{ x: 5, y: 5, width: 4, height: 4, color: RED }]); // area 16
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 10, minRegionArea: 16 });
    expect(boxes).toEqual([{ x: 5, y: 5, width: 4, height: 4 }]);
  });

  it("treats a color within tolerance of the background as background, not a region", () => {
    const nearWhite: RGB = { r: 250, g: 250, b: 250 }; // distance ~8.7 from pure white
    const pixels = makeBuffer(50, 50, WHITE, [{ x: 5, y: 5, width: 10, height: 10, color: nearWhite }]);
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 20 });
    expect(boxes).toEqual([]);
  });

  it("detects a color outside the tolerance as its own region", () => {
    const nearWhite: RGB = { r: 250, g: 250, b: 250 };
    const pixels = makeBuffer(50, 50, WHITE, [{ x: 5, y: 5, width: 10, height: 10, color: nearWhite }]);
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 2 });
    expect(boxes).toEqual([{ x: 5, y: 5, width: 10, height: 10 }]);
  });

  it("treats a fully transparent pixel as background regardless of its RGB value", () => {
    const pixels = makeBuffer(50, 50, WHITE, [
      { x: 5, y: 5, width: 10, height: 10, color: RED, alpha: 0 },
    ]);
    const boxes = segmentByBackgroundColor(pixels, { background: WHITE, colorTolerance: 5 });
    expect(boxes).toEqual([]);
  });
});

describe("detectBackgroundColor", () => {
  it("returns the color shared by all four corners", () => {
    const pixels = makeBuffer(40, 40, WHITE, [{ x: 15, y: 15, width: 10, height: 10, color: RED }]);
    expect(detectBackgroundColor(pixels)).toEqual(WHITE);
  });

  it("ignores a single corner touched by content, if the other three agree", () => {
    // A shape covering the top-left corner exactly.
    const pixels = makeBuffer(40, 40, WHITE, [{ x: 0, y: 0, width: 5, height: 5, color: RED }]);
    expect(detectBackgroundColor(pixels)).toEqual(WHITE);
  });
});

describe("keyOutBackground", () => {
  it("makes background-colored pixels transparent and leaves others opaque", () => {
    const pixels = makeBuffer(4, 1, WHITE, [{ x: 2, y: 0, width: 1, height: 1, color: RED }]);
    const keyed = keyOutBackground(pixels, WHITE, 10);
    // pixels 0,1,3 are background -> alpha 0; pixel 2 (red) stays opaque
    expect(keyed.data[3]).toBe(0);
    expect(keyed.data[7]).toBe(0);
    expect(keyed.data[11]).toBe(255); // red pixel's alpha, untouched
    expect(keyed.data[15]).toBe(0);
  });

  it("does not mutate the input buffer", () => {
    const pixels = makeBuffer(2, 1, WHITE, []);
    const original = pixels.data.slice();
    keyOutBackground(pixels, WHITE, 10);
    expect(pixels.data).toEqual(original);
  });
});

describe("tolerancePercentToDistance", () => {
  it("maps 0% to zero distance and 100% to the maximum possible RGB distance", () => {
    expect(tolerancePercentToDistance(0)).toBe(0);
    expect(tolerancePercentToDistance(100)).toBeCloseTo(Math.sqrt(3 * 255 * 255), 5);
  });

  it("clamps out-of-range percentages", () => {
    expect(tolerancePercentToDistance(-10)).toBe(0);
    expect(tolerancePercentToDistance(150)).toBeCloseTo(Math.sqrt(3 * 255 * 255), 5);
  });
});

describe("rgbToHex / hexToRgb", () => {
  it("round-trips a color through hex", () => {
    const color: RGB = { r: 18, g: 200, b: 7 };
    expect(hexToRgb(rgbToHex(color))).toEqual(color);
  });

  it("produces a lowercase #rrggbb string", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
  });

  it("parses a hex string case-insensitively", () => {
    expect(hexToRgb("#FF0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("rejects a malformed hex string", () => {
    expect(() => hexToRgb("not-a-color")).toThrow();
  });
});
