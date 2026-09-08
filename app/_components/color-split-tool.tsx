"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ImageSize, PixelBuffer } from "@/lib/types";
import {
  detectBackgroundColor,
  hexToRgb,
  rgbToHex,
  segmentByBackgroundColor,
  tolerancePercentToDistance,
} from "@/lib/color-segmenter";
import { cropWithColorKeyToPngBytes, imageToPixelBuffer, loadImageFromFile, parseResizeTarget, resizeBytesToBox, type ResizeTarget } from "@/lib/crop-image";
import { buildZip } from "@/lib/zip-export";
import { triggerDownload } from "@/lib/trigger-download";
import { buildExportFilename, padAndClampBox } from "@/lib/geometry";
import { ImageFileInput } from "./image-file-input";
import { ResizeControls } from "./resize-controls";

type Status = "idle" | "analyzing" | "error";

// Same visual-correlation-only role as object-splitter-tool.tsx's BOX_COLORS.
const BOX_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#db2777", "#65a30d"];

const DEFAULT_TOLERANCE_PERCENT = 12;

export function ColorSplitTool() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 });
  // Kept in state (not a ref) so the detection effect below can react to a
  // new photo the same way it reacts to a background/tolerance change —
  // one effect, one code path, instead of a separate "run once on upload"
  // branch that could drift out of sync with it.
  const [pixelBuffer, setPixelBuffer] = useState<PixelBuffer | null>(null);
  const [backgroundColorHex, setBackgroundColorHex] = useState("#ffffff");
  const [tolerancePercent, setTolerancePercent] = useState(DEFAULT_TOLERANCE_PERCENT);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [paddingRatio, setPaddingRatio] = useState(0.1);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeWidth, setResizeWidth] = useState("1024");
  const [resizeHeight, setResizeHeight] = useState("1024");
  const [resizeFill, setResizeFill] = useState<"transparent" | "color">("transparent");
  const [resizeColor, setResizeColor] = useState("#ffffff");
  const [exporting, setExporting] = useState<string | null>(null);
  // Same cleanup pattern as object-splitter-tool.tsx — see its own comment
  // for why this is a plain ref, and why the caller (not loadImageFromFile)
  // owns revoking it.
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Fully derived from pixelBuffer/backgroundColorHex/tolerancePercent —
  // computed during render (useMemo), not in an effect. Unlike
  // object-splitter's coco-ssd model (an expensive one-shot inference, only
  // ever re-filtered client-side after the fact), this is a cheap
  // deterministic pass over already-decoded pixels, so recomputing it live
  // as the user adjusts color/tolerance is fast enough to do on every
  // change, and gives much more useful feedback than a static one-time
  // detection would.
  const regions = useMemo(() => {
    if (!pixelBuffer) return [];
    return segmentByBackgroundColor(pixelBuffer, {
      background: hexToRgb(backgroundColorHex),
      colorTolerance: tolerancePercentToDistance(tolerancePercent),
    });
  }, [pixelBuffer, backgroundColorHex, tolerancePercent]);

  // "Adjust state during render" (not in an effect) for a value that's
  // derived from a prop/state change but still needs its own independent
  // state afterward (the user can then toggle individual selections) — the
  // pattern React's own docs recommend over resetting it from a useEffect.
  // useMemo above only produces a new `regions` array when its own
  // dependencies actually changed, so this comparison — and the reset it
  // triggers — only fires on a genuine re-segmentation, not every render.
  const [regionsSyncedFor, setRegionsSyncedFor] = useState(regions);
  if (regions !== regionsSyncedFor) {
    setRegionsSyncedFor(regions);
    setSelected(new Set(regions.map((_, i) => i)));
  }

  async function handleFile(file: File) {
    setError(null);
    setPixelBuffer(null);
    setStatus("analyzing");
    try {
      const { image, objectUrl } = await loadImageFromFile(file);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = objectUrl;
      setImageEl(image);
      setImageUrl(objectUrl);
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });

      const pixels = imageToPixelBuffer(image);
      setBackgroundColorHex(rgbToHex(detectBackgroundColor(pixels)));
      setPixelBuffer(pixels);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't process this photo.");
      setStatus("error");
    }
  }

  function toggleSelected(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(regions.map((_, i) => i)));
  }
  function deselectAll() {
    setSelected(new Set());
  }

  async function exportOne(
    index: number,
    resizeTarget: ResizeTarget | null,
  ): Promise<{ filename: string; bytes: Uint8Array }> {
    const region = regions[index];
    if (!imageEl) throw new Error("No image loaded.");
    const box = padAndClampBox(region, paddingRatio, imageSize);
    const keyOut = removeBackground
      ? { background: hexToRgb(backgroundColorHex), tolerance: tolerancePercentToDistance(tolerancePercent) }
      : null;
    let bytes = await cropWithColorKeyToPngBytes(imageEl, box, keyOut);
    if (resizeTarget) {
      bytes = await resizeBytesToBox(bytes, resizeTarget);
    }
    const filename = buildExportFilename("region", index + 1, "png");
    return { filename, bytes };
  }

  async function handleExportSelected() {
    const indices = regions.map((_, i) => i).filter((i) => selected.has(i));
    if (indices.length === 0) return;
    setError(null);
    try {
      const resizeTarget = parseResizeTarget(resizeEnabled, resizeWidth, resizeHeight, resizeFill, resizeColor);
      if (indices.length === 1) {
        setExporting("Processing…");
        const { filename, bytes } = await exportOne(indices[0], resizeTarget);
        triggerDownload(bytes, filename, "image/png");
      } else {
        const entries: { filename: string; data: Uint8Array }[] = [];
        for (let n = 0; n < indices.length; n++) {
          setExporting(`Processing ${n + 1}/${indices.length}…`);
          const { filename, bytes } = await exportOne(indices[n], resizeTarget);
          entries.push({ filename, data: bytes });
        }
        setExporting("Building zip…");
        const zipBytes = await buildZip(entries);
        triggerDownload(zipBytes, "regions.zip", "application/zip");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't export the selected regions.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <ImageFileInput onFile={handleFile} label="Choose an image" />

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div data-testid="status" className="text-sm text-gray-500">
        {status === "analyzing" && "Analyzing the image…"}
        {status === "idle" && pixelBuffer && regions.length === 0 &&
          "No separate regions found against this background color/tolerance — try raising the tolerance or picking a different background color below."}
      </div>

      {imageUrl && imageSize.width > 0 && (
        <div className="space-y-4">
          <div className="relative inline-block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- a locally created object URL, not an optimizable remote asset */}
            <img src={imageUrl} alt="Uploaded image" className="max-w-full rounded border border-gray-200" />
            {regions.map((box, i) => {
              const color = BOX_COLORS[i % BOX_COLORS.length];
              return (
                <div
                  key={i}
                  data-testid={`box-${i}`}
                  style={{
                    position: "absolute",
                    left: `${(box.x / imageSize.width) * 100}%`,
                    top: `${(box.y / imageSize.height) * 100}%`,
                    width: `${(box.width / imageSize.width) * 100}%`,
                    height: `${(box.height / imageSize.height) * 100}%`,
                    border: `2px solid ${color}`,
                    opacity: selected.has(i) ? 1 : 0.35,
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-600">Background color</span>
              <input
                type="color"
                value={backgroundColorHex}
                onChange={(e) => setBackgroundColorHex(e.target.value)}
                aria-label="Background color to split around"
                className="h-7 w-10 rounded border border-gray-300 p-0.5"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-600">Color match tolerance: {tolerancePercent}%</span>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={tolerancePercent}
                onChange={(e) => setTolerancePercent(Number(e.target.value))}
                aria-label="Color match tolerance"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-gray-600">Padding: {Math.round(paddingRatio * 100)}%</span>
              <input
                type="range"
                min={0}
                max={0.3}
                step={0.05}
                value={paddingRatio}
                onChange={(e) => setPaddingRatio(Number(e.target.value))}
                aria-label="Padding around each region"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeBackground}
                onChange={(e) => setRemoveBackground(e.target.checked)}
                aria-label="Make background transparent in exported crops"
              />
              <span className="text-gray-600">Make background transparent in exports</span>
            </label>
          </div>

          <ResizeControls
            enabled={resizeEnabled}
            onEnabledChange={setResizeEnabled}
            width={resizeWidth}
            onWidthChange={setResizeWidth}
            height={resizeHeight}
            onHeightChange={setResizeHeight}
            fill={resizeFill}
            onFillChange={setResizeFill}
            color={resizeColor}
            onColorChange={setResizeColor}
          />

          {regions.length > 0 && (
            <>
              <ul className="space-y-2">
                {regions.map((box, i) => {
                  const color = BOX_COLORS[i % BOX_COLORS.length];
                  return (
                    <li key={i} className="flex items-center justify-between gap-3 rounded border border-gray-200 p-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleSelected(i)}
                          aria-label={`Select region ${i + 1}`}
                        />
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                        <span>
                          Region {i + 1} ({box.width}×{box.height}px)
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={selectAll} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:border-gray-500">
                  Select all
                </button>
                <button type="button" onClick={deselectAll} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:border-gray-500">
                  Deselect all
                </button>
                <button
                  type="button"
                  onClick={handleExportSelected}
                  disabled={exporting !== null || selected.size === 0}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {exporting ?? `Download selected (${selected.size})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
