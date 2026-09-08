// @imgly/background-removal — a browser-only library (WASM + an ONNX
// segmentation model, fetched from IMG.LY's CDN on first use and cached by
// the browser afterward). Dynamic import keeps its model download from ever
// happening on a page load that doesn't use this specific feature.
//
// API shape verified against the package's own shipped
// node_modules/@imgly/background-removal/dist/src/{api/v1,schema}.d.ts and
// dist/index.mjs source, not assumed from search results — those turned out
// to be wrong on three counts, all caught by real verification rather than
// trusted as written (see HANDOVER.md D2):
// (1) the package's root entry only re-exports `removeBackground` as a
// named export (`index.d.ts` does `export * from './api/v1'`, which per ES
// module semantics never re-exports a default binding, even though
// `api/v1.d.ts` itself does have a default export) — caught by `npm run
// build`'s TypeScript check.
// (2) `Config.model`'s real values are "isnet" | "isnet_fp16" |
// "isnet_quint8", not "small" | "medium" as search summaries claimed.
// "isnet_quint8" is the quantized (smallest, fastest) variant — the right
// tradeoff for a free tool where every user pays the model-download cost
// themselves.
// (3) passing a bare Uint8Array/ArrayBuffer does NOT work even though the
// library's own type declares it as an accepted `ImageSource` — internally
// (`imageSourceToImageData` in dist/index.mjs) it does `new Blob([image])`
// with no `type` set, then decodes purely by switching on `blob.type`
// (`imageDecode` in the same file) with no magic-byte sniffing at all. An
// untyped Blob hits that switch's default case and throws "Invalid format:
// with params: [object Object]" — a real bug in this library's byte-input
// path, caught by an actual failing Playwright e2e run against a real
// photo, not by reading the types. Worked around by requiring the caller to
// supply the real MIME type and constructing a correctly-typed Blob here.
export async function removeImageBackground(input: Uint8Array, mimeType: string): Promise<Uint8Array> {
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(new Blob([input.slice() as BlobPart], { type: mimeType }), {
    model: "isnet_quint8",
    output: { format: "image/png" },
  });
  return new Uint8Array(await blob.arrayBuffer());
}
