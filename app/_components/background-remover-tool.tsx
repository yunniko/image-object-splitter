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
  // Which tier actually produced the current result (as opposed to
  // `selectedModel`, which tracks the picker and can move ahead of it once
  // the user changes their mind post-result) — lets the UI offer a retry
  // instead of forcing a full re-upload just to compare tiers on the same
  // photo. Kept alongside the raw bytes/filename (not just the File
  // object) since a File's own contents aren't re-readable after the
  // input's value resets; storing the decoded bytes once is simpler than
  // re-deriving them.
  const [lastUsedModel, setLastUsedModel] = useState<ModelTier | null>(null);
  const [storedInput, setStoredInput] = useState<{ bytes: Uint8Array; mimeType: string; baseName: string } | null>(
    null,
  );
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

  async function processInput(bytes: Uint8Array, mimeType: string, baseName: string, model: ModelTier) {
    setError(null);
    setResultBytes(null);
    setResultUrl(null);
    setProgress(null);
    setStatus("processing");
    setFilename(baseName + "-no-bg.png");
    try {
      const outputBytes = await removeImageBackground(bytes, mimeType, {
        model,
        onProgress: setProgress,
      });
      setResultBytes(outputBytes);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const newUrl = URL.createObjectURL(new Blob([outputBytes.slice() as BlobPart], { type: "image/png" }));
      objectUrlRef.current = newUrl;
      setResultUrl(newUrl);
      setStatus("done");
      setLastUsedModel(model);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the background from this photo.");
      setStatus("error");
    } finally {
      setProgress(null);
    }
  }

  async function handleFile(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    setStoredInput({ bytes, mimeType, baseName });
    await processInput(bytes, mimeType, baseName, selectedModel);
  }

  // Re-runs the same already-uploaded photo through a different tier
  // without asking the user to re-pick the file — see storedInput's own
  // comment for why the raw bytes are kept rather than the File object.
  async function handleRetryWithSelectedModel() {
    if (!storedInput) return;
    await processInput(storedInput.bytes, storedInput.mimeType, storedInput.baseName, selectedModel);
  }

  const selectedTierLabel = MODEL_TIERS.find((tier) => tier.model === selectedModel)?.label ?? selectedModel;
  const canRetryWithDifferentModel =
    storedInput !== null && status !== "processing" && lastUsedModel !== null && lastUsedModel !== selectedModel;

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2" disabled={status === "processing"}>
        <legend className="mb-1 text-sm font-medium text-gray-700">Quality</legend>
        {MODEL_TIERS.map((tier, tierIndex) => {
          const isDownloaded = downloadedHintsKey[tierIndex] === "1";
          return (
            <label
              key={tier.model}
              className={`flex items-start gap-2 rounded border p-2 has-[:checked]:ring-2 has-[:checked]:ring-blue-400 ${
                isDownloaded ? "border-green-400 bg-green-50" : "border-gray-200"
              }`}
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
                <span className={isDownloaded ? "text-green-700" : "text-gray-500"}>
                  — {Math.round(tier.downloadBytes / 1024 / 1024)} MB download
                  {isDownloaded ? ", downloaded before in this browser" : ""}
                </span>
                <br />
                <span className="text-gray-500">{tier.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {canRetryWithDifferentModel && (
        <div className="flex items-center gap-3 rounded border border-blue-200 bg-blue-50 p-2 text-sm">
          <span className="text-blue-900">You picked a different quality than the photo below was processed with.</span>
          <button
            type="button"
            onClick={handleRetryWithSelectedModel}
            className="shrink-0 rounded bg-blue-700 px-3 py-1.5 font-medium text-white hover:bg-blue-800"
          >
            Retry with {selectedTierLabel}
          </button>
        </div>
      )}

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
