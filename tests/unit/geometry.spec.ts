import { describe, expect, it } from "vitest";
import {
  assignPerClassIndices,
  boxArea,
  buildExportFilename,
  filterByScore,
  padAndClampBox,
  slugifyClassName,
  sortByScoreDescending,
} from "@/lib/geometry";
import type { Detection } from "@/lib/types";

describe("padAndClampBox", () => {
  it("expands a box by the padding ratio on every side", () => {
    const box = { x: 100, y: 100, width: 40, height: 20 };
    const result = padAndClampBox(box, 0.5, { width: 1000, height: 1000 });
    // 0.5 ratio -> pad by 50% of width (20px) and 50% of height (10px) each side
    expect(result).toEqual({ x: 80, y: 90, width: 80, height: 40 });
  });

  it("clamps to the image's left/top edge instead of going negative", () => {
    const box = { x: 5, y: 5, width: 20, height: 20 };
    const result = padAndClampBox(box, 1, { width: 1000, height: 1000 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("clamps to the image's right/bottom edge", () => {
    const box = { x: 980, y: 980, width: 20, height: 20 };
    const result = padAndClampBox(box, 1, { width: 1000, height: 1000 });
    expect(result.x + result.width).toBeLessThanOrEqual(1000);
    expect(result.y + result.height).toBeLessThanOrEqual(1000);
  });

  it("never produces a zero-width or zero-height box, even for a degenerate input", () => {
    const box = { x: 500, y: 500, width: 0, height: 0 };
    const result = padAndClampBox(box, 0, { width: 1000, height: 1000 });
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it("handles a box that already fills the whole image with padding requested", () => {
    const box = { x: 0, y: 0, width: 1000, height: 1000 };
    const result = padAndClampBox(box, 0.2, { width: 1000, height: 1000 });
    expect(result).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
  });

  it("rejects a negative padding ratio", () => {
    expect(() => padAndClampBox({ x: 0, y: 0, width: 10, height: 10 }, -0.1, { width: 100, height: 100 })).toThrow();
  });
});

describe("boxArea", () => {
  it("multiplies width by height", () => {
    expect(boxArea({ x: 0, y: 0, width: 4, height: 5 })).toBe(20);
  });
});

function makeDetection(className: string, score: number): Detection {
  return { className, score, bbox: { x: 0, y: 0, width: 10, height: 10 } };
}

describe("filterByScore", () => {
  it("keeps only detections at or above the threshold", () => {
    const detections = [makeDetection("cat", 0.9), makeDetection("dog", 0.4), makeDetection("cat", 0.5)];
    const result = filterByScore(detections, 0.5);
    expect(result).toHaveLength(2);
    expect(result.every((d) => d.score >= 0.5)).toBe(true);
  });
});

describe("sortByScoreDescending", () => {
  it("orders highest score first without mutating the input array", () => {
    const detections = [makeDetection("cat", 0.4), makeDetection("dog", 0.9), makeDetection("bird", 0.6)];
    const original = [...detections];
    const result = sortByScoreDescending(detections);
    expect(result.map((d) => d.className)).toEqual(["dog", "bird", "cat"]);
    expect(detections).toEqual(original);
  });
});

describe("slugifyClassName", () => {
  it("replaces spaces with hyphens and lowercases", () => {
    expect(slugifyClassName("Sports Ball")).toBe("sports-ball");
  });

  it("strips characters unsafe for a filename", () => {
    expect(slugifyClassName("tv/monitor")).toBe("tvmonitor");
  });

  it("falls back to a safe default if nothing is left after stripping", () => {
    expect(slugifyClassName("???")).toBe("object");
  });
});

describe("buildExportFilename", () => {
  it("combines the slugified class, index, and extension", () => {
    expect(buildExportFilename("potted plant", 2, "png")).toBe("potted-plant-2.png");
  });
});

describe("assignPerClassIndices", () => {
  it("numbers repeated classes independently, starting at 1", () => {
    const detections = [makeDetection("cat", 0.9), makeDetection("dog", 0.8), makeDetection("cat", 0.7)];
    expect(assignPerClassIndices(detections)).toEqual([1, 1, 2]);
  });

  it("returns an empty array for no detections", () => {
    expect(assignPerClassIndices([])).toEqual([]);
  });
});
