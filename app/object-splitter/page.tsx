import type { Metadata } from "next";
import Link from "next/link";
import { ObjectSplitterTool } from "../_components/object-splitter-tool";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Photo Object Splitter — Crop Every Object in an Image",
  description:
    "Upload a photo, detect the distinct objects in it, and export each one as its own PNG — optionally with the background removed. Runs on your device, no uploads.",
};

const FAQ = [
  {
    question: "What kinds of objects can it detect?",
    answer:
      "The detector recognizes 80 common object categories (people, animals, vehicles, furniture, food, and everyday items) using the COCO-SSD model. It won't recognize objects outside that list, and may miss small, overlapping, or partially hidden objects.",
  },
  {
    question: "Does my photo get uploaded anywhere?",
    answer:
      "No. Detection, cropping, and background removal all run in your browser using on-device AI models. Your photo never leaves your device.",
  },
  {
    question: "Why does the first detection take a few seconds?",
    answer:
      "The detection model (a few megabytes) downloads the first time you use the tool in a session and is cached by your browser afterward — later photos in the same session detect faster.",
  },
  {
    question: "What does the padding slider do?",
    answer:
      "It adds a margin around each detected object before cropping, so the exported image isn't cropped exactly to the edge of the object. It's clamped to the photo's own edges, so it never adds blank space beyond the original photo.",
  },
];

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />

      <nav className="mb-6 text-sm">
        <Link href="/" className="text-blue-600 hover:underline">
          ← All tools
        </Link>
      </nav>

      <h1 className="text-3xl font-semibold">Photo Object Splitter</h1>
      <p className="mt-3 text-gray-600">
        Upload a photo, pick which detected objects you want, and download each as its own image.
      </p>

      <div className="mt-6">
        <ObjectSplitterTool />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <dl className="mt-3 space-y-4">
          {FAQ.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-gray-900">{item.question}</dt>
              <dd className="mt-1 text-gray-600">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
