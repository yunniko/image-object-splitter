import { readFileSync } from "node:fs";

// Minimal PNG IHDR reader — width/height are always the first 8 bytes of
// chunk data after the 8-byte signature + 4-byte length + 4-byte "IHDR" tag,
// per the PNG spec, regardless of the rest of the file's content/encoding.
// Shared by every e2e test that needs to assert a downloaded PNG's actual
// pixel dimensions without pulling in an image-decoding dependency.
export function readPngDimensions(filePath: string): { width: number; height: number } {
  const buffer = readFileSync(filePath);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
