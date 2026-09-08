import type { MetadataRoute } from "next";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: APP_URL, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${APP_URL}/object-splitter`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${APP_URL}/split-by-color`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${APP_URL}/background-remover`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
  ];
}
