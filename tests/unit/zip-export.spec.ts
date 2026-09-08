import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildZip } from "@/lib/zip-export";

describe("buildZip", () => {
  it("produces a zip that round-trips every entry's exact bytes", async () => {
    const entries = [
      { filename: "cat-1.png", data: new Uint8Array([1, 2, 3, 4]) },
      { filename: "dog-1.png", data: new Uint8Array([5, 6, 7]) },
    ];
    const zipBytes = await buildZip(entries);

    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files).sort()).toEqual(["cat-1.png", "dog-1.png"]);

    const catBytes = await zip.file("cat-1.png")!.async("uint8array");
    expect(Array.from(catBytes)).toEqual([1, 2, 3, 4]);

    const dogBytes = await zip.file("dog-1.png")!.async("uint8array");
    expect(Array.from(dogBytes)).toEqual([5, 6, 7]);
  });

  it("produces an empty-but-valid zip for no entries", async () => {
    const zipBytes = await buildZip([]);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});
