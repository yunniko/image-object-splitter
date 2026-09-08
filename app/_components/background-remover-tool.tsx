"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_MODEL_TIER,
  MODEL_TIERS,
  hasLikelyDownloadedModel,
  removeImageBackground,
  subscribeToModelDownloadHints,
  type ModelTier,
  type RemovalProgress,
} from "@/lib/background-remover";
import { ImageFileInput } from "./image-file-input";
import { DownloadBlobButton } from "./download-blob-button";
import { Spinner } from "./spinner";

type Status = "idle" | "processing" | "done" | "error";

export function BackgroundRemoverTool() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("background-removed.png");
  const [selectedModel, setSelectedModel] = useState<ModelTier>(DEFAULT_MODEL_TIER);
  const [progress, setProgress] = useState<RemovalProgress | null>(null);
  // localStorage doesn't exist during SSR, so this reads through
  // useSyncExternalStore rather than a plain useState — its
  // getServerSnapshot returns "all false" for the server-rendered/pre-
  // hydration pass, then the real client snapshot takes over, avoiding a
  // hydration mismatch. Re-renders automatically on the custom event
  // markModelDownloaded fires (same tab) or the native `storage` event
  // (another tab with this page open) — see subscribeToModelDownloadHints.
  const downloadedHintsKey = useSyncExternalStore(
    subscribeToModelDownloadHints,
    () => MODEL_TIERS.map((tier) => (hasLikelyDownloadedModel(tier.model) ? "1" : "0")).join(""),
    () => "0".repeat(MODEL_TIERS.length),
  );
  // Same object-URL lifetime concern as object-splitter-tool.tsx: revoke
  // the previous result's URL once a new one replaces it, or on unmount,
  // rather than never (a real leak on repeated use in one session).
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setResultBytes(null);
    setResultUrl(null);
    setProgress(null);
    setStatus("processing");
    setFilename(file.name.replace(/\.[^.]+$/, "") + "-no-bg.png");
    try {
      const inputBytes = new Uint8Array(await file.arrayBuffer());
      const outputBytes = await removeImageBackground(inputBytes, file.type || "image/jpeg", {
        model: selectedModel,
        onProgress: setProgress,
      });
      setResultBytes(outputBytes);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const newUrl = URL.createObjectURL(new Blob([outputBytes.slice() as BlobPart], { type: "image/png" }));
      objectUrlRef.current = newUrl;
      setResultUrl(newUrl);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the background from this photo.");
      setStatus("error");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2" disabled={status === "processing"}>
        <legend className="mb-1 text-sm font-medium text-gray-700">Quality</legend>
        {MODEL_TIERS.map((tier, tierIndex) => (
          <label
            key={tier.model}
            className="flex items-start gap-2 rounded border border-gray-200 p-2 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50"
          >
            <input
              type="radio"
              name="model-tier"
              className="mt-1"
              checked={selectedModel === tier.model}
              onChange={() => setSelectedModel(tier.model)}
              aria-label={tier.label}
            />
            <span className="text-sm">
              <span className="font-medium text-gray-900">{tier.label}</span>{" "}
              <span className="text-gray-500">
                — {Math.round(tier.downloadBytes / 1024 / 1024)} MB download
                {downloadedHintsKey[tierIndex] === "1" ? ", downloaded before in this browser" : ""}
              </span>
              <br />
              <span className="text-gray-500">{tier.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <ImageFileInput onFile={handleFile} label="Choose a photo" />

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div data-testid="status" className="space-y-2 text-sm text-gray-500">
        {status === "processing" && (
          <>
            <div className="flex items-center gap-2">
              <Spinner />
              <span>{progress?.label ?? "Preparing…"}</span>
            </div>
            {progress?.fraction != null ? (
              <progress
                className="h-2 w-full max-w-xs"
                value={progress.fraction}
                max={1}
                aria-label="Progress"
              />
            ) : (
              <progress className="h-2 w-full max-w-xs" aria-label="Progress" />
            )}
          </>
        )}
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
