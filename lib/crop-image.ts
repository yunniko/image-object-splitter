import { computeContainFit, type FitBox } from "./geometry";
import { keyOutBackground } from "./color-segmenter";
import type { BoundingBox, PixelBuffer, RGB } from "./types";

// Crops `box` out of `image` onto a same-size canvas and encodes it as PNG
// bytes. PNG (not JPEG) specifically because the background-removal step
// downstream produces an alpha channel that a lossy JPEG would destroy.
export async function cropToPngBytes(
  image: HTMLImageElement,
  box: BoundingBox,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is unavailable in this browser.");

  ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to encode the cropped image as PNG.");
  return new Uint8Array(await blob.arrayBuffer());
}

// Draws the whole (already-decoded) image onto an offscreen canvas and
// reads back its raw pixel data — the DOM-dependent half of color
// segmentation; lib/color-segmenter.ts's algorithm itself only ever touches
// this plain data shape, not the canvas. Safe against canvas tainting
// because the image always comes from loadImageFromFile's local blob: URL,
// never a cross-origin source.
export function imageToPixelBuffer(image: HTMLImageElement): PixelBuffer {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is unavailable in this browser.");
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: imageData.data, width: canvas.width, height: canvas.height };
}

// Same crop as cropToPngBytes, with an optional color-key step: pixels
// within `keyOut.tolerance` of `keyOut.background` are made transparent
// before encoding. Kept as a separate function (rather than an optional
// param on cropToPngBytes) so the object-splitter tool's crop path — which
// has no concept of a known background color — is untouched.
export async function cropWithColorKeyToPngBytes(
  image: HTMLImageElement,
  box: BoundingBox,
  keyOut: { background: RGB; tolerance: number } | null,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is unavailable in this browser.");

  ctx.drawImage(image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);

  if (keyOut) {
    const imageData = ctx.getImageData(0, 0, box.width, box.height);
    const keyed = keyOutBackground(
      { data: imageData.data, width: box.width, height: box.height },
      keyOut.background,
      keyOut.tolerance,
    );
    imageData.data.set(keyed.data);
    ctx.putImageData(imageData, 0, 0);
  }

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to encode the cropped image as PNG.");
  return new Uint8Array(await blob.arrayBuffer());
}

// A resize target: an exact pixel box plus what to do with the leftover
// space around the scaled image (contain-fit never fills the whole box
// unless its aspect ratio exactly matches the source's). "transparent"
// relies on the canvas's own default (unpainted pixels stay alpha 0) —
// same reason cropToPngBytes above always encodes as PNG, never JPEG.
export interface ResizeTarget {
  width: number;
  height: number;
  background: "transparent" | string;
}

// Shared by every export tool that offers the resize feature: turns its raw
// UI state into a ResizeTarget, or null when the feature is off. Throws
// (rather than returning an error value) so a caller can validate once per
// export batch inside its existing try/catch, same pattern as every other
// export-time failure in these tools.
export function parseResizeTarget(
  enabled: boolean,
  width: string,
  height: string,
  fill: "transparent" | "color",
  color: string,
): ResizeTarget | null {
  if (!enabled) return null;
  const w = Number(width);
  const h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) {
    throw new Error("Resize width and height must be positive whole numbers.");
  }
  return { width: w, height: h, background: fill === "transparent" ? "transparent" : color };
}

// Decodes `pngBytes`, scales it to fit `target` without deforming it
// (via computeContainFit), and re-encodes onto a `target.width` x
// `target.height` canvas — the leftover space is either left transparent or
// filled with `target.background` first. `createImageBitmap` is used
// instead of an <img> element because the input is already-decoded PNG
// bytes (the crop/background-removal steps' own output), not a File/Blob
// that needs the object-URL dance loadImageFromFile does.
export async function resizeBytesToBox(pngBytes: Uint8Array, target: ResizeTarget): Promise<Uint8Array> {
  const box: FitBox = { width: target.width, height: target.height };
  const sourceBlob = new Blob([pngBytes.slice() as BlobPart], { type: "image/png" });
  const bitmap = await createImageBitmap(sourceBlob);
  try {
    const fit = computeContainFit({ width: bitmap.width, height: bitmap.height }, box);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(target.width);
    canvas.height = Math.round(target.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context is unavailable in this browser.");

    if (target.background !== "transparent") {
      ctx.fillStyle = target.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, fit.x, fit.y, fit.width, fit.height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Failed to encode the resized image as PNG.");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

// Returns the object URL alongside the image rather than revoking it once
// loaded: the caller also uses this same URL as the visible <img> preview's
// src, and a *new* <img> element assigned an already-revoked blob: URL fails
// to load in spec-compliant browsers (the blob URL registry entry is gone
// even though the original Image object already decoded it). The caller
// owns revoking it — when a new photo replaces this one, or on unmount.
export function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl: url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read this file as an image."));
    };
    image.src = url;
  });
}
