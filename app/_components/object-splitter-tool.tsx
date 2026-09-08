"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Detection, ImageSize } from "@/lib/types";
import { detectObjects } from "@/lib/object-detector";
import { cropToPngBytes, loadImageFromFile, parseResizeTarget, resizeBytesToBox, type ResizeTarget } from "@/lib/crop-image";
import { removeImageBackground } from "@/lib/background-remover";
import { buildZip } from "@/lib/zip-export";
import { triggerDownload } from "@/lib/trigger-download";
import { assignPerClassIndices, buildExportFilename, padAndClampBox } from "@/lib/geometry";
import { ImageFileInput } from "./image-file-input";
import { ResizeControls } from "./resize-controls";
import { Spinner } from "./spinner";

type Status = "idle" | "loading-model" | "detecting" | "ready" | "no-objects" | "error";

// Cycled by detection index so each bounding box and its matching list item
// share a color — purely a visual correlation aid, has no effect on export.
const BOX_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#db2777", "#65a30d"];

// coco-ssd is run once at exactly its own documented default minScore
// (0.5) and the confidence slider only ever raises the *displayed*
// threshold from there, never lowers it below what was actually detected.
// This is load-bearing, not just a UX choice: coco-ssd's own detect() call
// passes minScore as BOTH the score threshold AND the IoU threshold to
// non-max suppression (see node_modules/@tensorflow-models/coco-ssd/dist/
// coco-ssd.js's `infer()`), so detecting at a lower threshold than 0.5 to
// "pre-fetch more results to filter later" actually changes which boxes
// survive suppression, not just which ones are shown — a real domain-expert
// finding (2026-09-08, see docs/domain-reference.md), verified directly
// against the vendored source before this fix.
const DETECT_MIN_SCORE = 0.5;

export function ObjectSplitterTool() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 });
  const [detections, setDetections] = useState<Detection[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [minScore, setMinScore] = useState(0.5);
  const [paddingRatio, setPaddingRatio] = useState(0.1);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeWidth, setResizeWidth] = useState("1024");
  const [resizeHeight, setResizeHeight] = useState("1024");
  const [resizeFill, setResizeFill] = useState<"transparent" | "color">("transparent");
  const [resizeColor, setResizeColor] = useState("#ffffff");
  const [exporting, setExporting] = useState<string | null>(null);
  // Tracks the currently-live object URL so it can be revoked exactly once
  // it's no longer referenced by anything (a new photo replacing it, or
  // this component unmounting) - not revoked in loadImageFromFile itself,
  // see that function's own comment for why. A plain ref, not state: this
  // is bookkeeping for cleanup, not something a re-render should depend on.
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const perClassIndices = useMemo(() => assignPerClassIndices(detections), [detections]);

  async function handleFile(file: File) {
    setError(null);
    setDetections([]);
    setSelected(new Set());
    setStatus("loading-model");
    try {
      const { image, objectUrl } = await loadImageFromFile(file);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = objectUrl;
      setImageEl(image);
      setImageUrl(objectUrl);
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      setImageSize(size);

      setStatus("detecting");
      const found = await detectObjects(image, DETECT_MIN_SCORE);
      if (found.length === 0) {
        setStatus("no-objects");
        return;
      }
      setDetections(found);
      setSelected(new Set(found.map((_, i) => i)));
      setStatus("ready");
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

  const visibleIndices = detections
    .map((d, i) => i)
    .filter((i) => detections[i].score >= minScore);

  function selectAll() {
    setSelected(new Set(visibleIndices));
  }
  function deselectAll() {
    setSelected(new Set());
  }

  async function exportOne(
    index: number,
    resizeTarget: ResizeTarget | null,
    progressPrefix: string,
  ): Promise<{ filename: string; bytes: Uint8Array }> {
    const detection = detections[index];
    if (!imageEl) throw new Error("No image loaded.");
    const box = padAndClampBox(detection.bbox, paddingRatio, imageSize);
    let bytes = await cropToPngBytes(imageEl, box);
    if (removeBackground) {
      bytes = await removeImageBackground(bytes, "image/png", {
        onProgress: (progress) => setExporting(`${progressPrefix}${progress.label}`),
      });
    }
    if (resizeTarget) {
      bytes = await resizeBytesToBox(bytes, resizeTarget);
    }
    const filename = buildExportFilename(detection.className, perClassIndices[index], "png");
    return { filename, bytes };
  }

  async function handleExportSelected() {
    const indices = visibleIndices.filter((i) => selected.has(i));
    if (indices.length === 0) return;
    setError(null);
    try {
      const resizeTarget = parseResizeTarget(resizeEnabled, resizeWidth, resizeHeight, resizeFill, resizeColor);
      if (indices.length === 1) {
        setExporting("Processing…");
        const { filename, bytes } = await exportOne(indices[0], resizeTarget, "");
        triggerDownload(bytes, filename, "image/png");
      } else {
        const entries: { filename: string; data: Uint8Array }[] = [];
        for (let n = 0; n < indices.length; n++) {
          const prefix = `${n + 1}/${indices.length}: `;
          setExporting(`${prefix}Processing…`);
          const { filename, bytes } = await exportOne(indices[n], resizeTarget, prefix);
          entries.push({ filename, data: bytes });
        }
        setExporting("Building zip…");
        const zipBytes = await buildZip(entries);
        triggerDownload(zipBytes, "objects.zip", "application/zip");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't export the selected objects.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <ImageFileInput onFile={handleFile} label="Choose a photo" />

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div data-testid="status" className="text-sm text-gray-500">
        {status === "loading-model" && "Loading the detection model (first use downloads it, then it's cached)…"}
        {status === "detecting" && "Detecting objects…"}
        {status === "no-objects" && "No recognizable objects found in this photo (the detector recognizes 80 common object types)."}
      </div>

      {imageUrl && imageSize.width > 0 && detections.length > 0 && (
        <div className="space-y-4">
          <div className="relative inline-block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- a locally created object URL, not an optimizable remote asset */}
            <img src={imageUrl} alt="Uploaded photo" className="max-w-full rounded border border-gray-200" />
            {visibleIndices.map((i) => {
              const d = detections[i];
              const color = BOX_COLORS[i % BOX_COLORS.length];
              return (
                <div
                  key={i}
                  data-testid={`box-${i}`}
                  style={{
                    position: "absolute",
                    left: `${(d.bbox.x / imageSize.width) * 100}%`,
                    top: `${(d.bbox.y / imageSize.height) * 100}%`,
                    width: `${(d.bbox.width / imageSize.width) * 100}%`,
                    height: `${(d.bbox.height / imageSize.height) * 100}%`,
                    border: `2px solid ${color}`,
                    opacity: selected.has(i) ? 1 : 0.35,
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-gray-600">Minimum confidence: {Math.round(minScore * 100)}%</span>
              <input
                type="range"
                min={0.5}
                max={0.95}
                step={0.05}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                aria-label="Minimum confidence"
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
                aria-label="Padding around each object"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeBackground}
                onChange={(e) => setRemoveBackground(e.target.checked)}
                aria-label="Remove background from exported crops"
              />
              <span className="text-gray-600">Remove background from exports</span>
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

          <ul className="space-y-2">
            {visibleIndices.map((i) => {
              const d = detections[i];
              const color = BOX_COLORS[i % BOX_COLORS.length];
              return (
                <li key={i} className="flex items-center justify-between gap-3 rounded border border-gray-200 p-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelected(i)}
                      aria-label={`Select ${d.className} ${perClassIndices[i]}`}
                    />
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="capitalize">
                      {d.className} {perClassIndices[i]}
                    </span>
                    <span className="text-xs text-gray-500">{Math.round(d.score * 100)}%</span>
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
              className="flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {exporting && <Spinner className="h-4 w-4 text-white" />}
              {exporting ?? `Download selected (${selected.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
