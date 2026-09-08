import JSZip from "jszip";

export interface ZipEntry {
  filename: string;
  data: Uint8Array;
}

// Bundles multiple exported crops into one .zip, returned as raw bytes
// (not a browser Blob) so this function works identically in Node (Vitest)
// and the browser — the UI wraps the result in a Blob only at the point of
// triggering a download.
export async function buildZip(entries: ZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.filename, entry.data);
  }
  return zip.generateAsync({ type: "uint8array" });
}
