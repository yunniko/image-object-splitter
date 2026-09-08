import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Image Object Splitter & Background Remover",
  description:
    "Free browser-based tools: detect objects in a photo and export each as its own file, or remove a photo's background — no uploads, no sign-up.",
};

const TOOLS = [
  {
    href: "/object-splitter",
    title: "Object splitter — crop every object in a photo",
    description:
      "Upload a photo, detect the distinct objects in it, pick which ones you want, and download each as its own image (optionally with the background removed).",
  },
  {
    href: "/background-remover",
    title: "Background remover",
    description:
      "Remove the background from a single photo and download a transparent PNG — runs entirely on your device.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Image Object Splitter</h1>
      <p className="mt-3 text-gray-600">
        Free photo tools that run entirely in your browser — your images are
        never uploaded to a server. Detection and background removal both use
        on-device AI models.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-lg border border-gray-200 p-5 hover:border-gray-400"
          >
            <h2 className="font-semibold text-blue-700">{tool.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{tool.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
