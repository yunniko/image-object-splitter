import type { Metadata } from "next";
import Link from "next/link";
import { ColorSplitTool } from "../_components/color-split-tool";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Split an Image by Background Color — Cut Apart an Icon or Sprite Sheet",
  description:
    "Upload an image with items on a single solid background (an icon sheet, sprite sheet, or product photos on a seamless background) and export each item as its own PNG, optionally with a transparent background. Runs on your device, no uploads.",
};

const FAQ = [
  {
    question: "How is this different from the object splitter tool?",
    answer:
      "The object splitter uses an AI model trained to recognize 80 real-world photo categories (people, animals, furniture, and so on) — it won't recognize an app icon or a logo. This tool doesn't use AI at all: it looks at which pixels are close to a known background color and treats every other contiguous group of pixels as a separate item. That makes it a better fit for icon sheets, sprite sheets, scanned stickers, or product photos on a seamless background — anything with items sitting on one mostly-uniform background color.",
  },
  {
    question: "How is the background color chosen?",
    answer:
      "It's guessed automatically from the image's four corners when you upload it. You can override it with the color picker if the guess is wrong, or if you want to split on a different color on purpose.",
  },
  {
    question: "What does the tolerance slider do?",
    answer:
      "It controls how close a pixel's color has to be to the background color to still count as background. Raise it if a soft/anti-aliased edge or a slightly noisy background (e.g. a JPEG-compressed photo) is being picked up as part of an item; lower it if two items that are actually touching are being merged into one.",
  },
  {
    question: "Does my image get uploaded anywhere?",
    answer: "No. Everything — analysis, cropping, and the transparent-background export — runs in your browser. Your image never leaves your device.",
  },
  {
    question: "What happens if two items are touching, or the background isn't uniform?",
    answer:
      "Items that touch or overlap get detected as a single connected region, not split apart — this tool only separates regions that are actually disconnected by background-colored pixels. A background with a gradient, texture, or shadow will also be harder to match consistently; raising the tolerance helps to a point, but a genuinely uniform background works best.",
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

      <h1 className="text-3xl font-semibold">Split an Image by Background Color</h1>
      <p className="mt-3 text-gray-600">
        Upload an icon sheet, sprite sheet, or any image with items on one solid background, and download each item as its own image.
      </p>

      <div className="mt-6">
        <ColorSplitTool />
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
