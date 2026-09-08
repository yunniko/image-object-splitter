import type { BoundingBox } from "./types";

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
