import type { Metadata } from "next";
import Link from "next/link";
import { BackgroundRemoverTool } from "../_components/background-remover-tool";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Background Remover — Free, No Uploads",
  description:
    "Remove the background from a photo and download a transparent PNG. Runs entirely on your device using an on-device AI model — nothing is uploaded to a server.",
};

const FAQ = [
  {
    question: "Is this really free, no account needed?",
    answer: "Yes — no sign-up, no watermark, no upload limit tied to an account. It runs entirely in your browser.",
  },
  {
    question: "Does my photo get uploaded to a server?",
    answer:
      "No. The AI model that removes the background downloads to your browser once and then runs locally — your photo itself is never sent anywhere.",
  },
  {
    question: "Why is the first run slow?",
    answer:
      "The AI segmentation model is a real download — 42 to 168 MB depending on the quality level you pick below. It downloads once per browser and is cached afterward, so later photos (and the same quality level on a later visit) process faster.",
  },
  {
    question: "What do the quality levels mean?",
    answer:
      "They're different sizes of the same AI model. Fast is the smallest and quickest but more likely to leave rough edges or small gaps on a busy background; Best quality is the most accurate but the largest download. \"Downloaded before in this browser\" is a best-effort hint based on your own past use here, not a live check of your browser's cache — it can occasionally be wrong if your browser has since cleared its cache, in which case you'll just see a real download instead of a surprise-free one.",
  },
  {
    question: "What file format is the result?",
    answer: "A PNG with a transparent background, so it can be placed over any other image or color.",
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

      <h1 className="text-3xl font-semibold">Background Remover</h1>
      <p className="mt-3 text-gray-600">
        Upload a photo and download a version with the background removed.
      </p>

      <div className="mt-6">
        <BackgroundRemoverTool />
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
