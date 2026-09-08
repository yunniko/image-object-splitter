"use client";

import { useState } from "react";
import { removeImageBackground } from "@/lib/background-remover";
import { ImageFileInput } from "./image-file-input";
import { DownloadBlobButton } from "./download-blob-button";

type Status = "idle" | "processing" | "done" | "error";

export function BackgroundRemoverTool() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("background-removed.png");

  async function handleFile(file: File) {
    setError(null);
    setResultBytes(null);
    setResultUrl(null);
    setStatus("processing");
    setFilename(file.name.replace(/\.[^.]+$/, "") + "-no-bg.png");
    try {
      const inputBytes = new Uint8Array(await file.arrayBuffer());
      const outputBytes = await removeImageBackground(inputBytes, file.type || "image/jpeg");
      setResultBytes(outputBytes);
      setResultUrl(URL.createObjectURL(new Blob([outputBytes.slice() as BlobPart], { type: "image/png" })));
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the background from this photo.");
      setStatus("error");
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
        {status === "processing" && "Removing the background (first use downloads an AI model, then it's cached)…"}
      </div>

      {resultUrl && (
        <div className="space-y-4">
          <div
            className="inline-block rounded border border-gray-200 p-2"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a locally created object URL, not an optimizable remote asset */}
            <img src={resultUrl} alt="Background removed" className="max-w-full" data-testid="result-image" />
          </div>
          <DownloadBlobButton bytes={resultBytes} filename={filename} mimeType="image/png" label="Download PNG" />
        </div>
      )}
    </div>
  );
}
