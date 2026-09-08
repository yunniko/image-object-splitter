// Shared by every export tool in this project — a plain client-side "save
// these bytes as a file" helper with no tool-specific knowledge, so it lives
// here rather than being copy-pasted into each tool component.
export function triggerDownload(bytes: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([bytes.slice() as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
