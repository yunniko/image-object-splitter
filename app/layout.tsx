import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SERVICE_NAME = "Image Object Splitter";
const SERVICE_DESCRIPTION =
  "Detect objects in a photo and export each one as its own image, or remove a photo's background — entirely in your browser, nothing is ever uploaded.";

// Same AdSense publisher account across every svc-lab service (see
// svc-lab/HANDOVER.md's Owner action list) - set as an env var per
// deploy rather than hardcoded so a service can opt out by leaving it
// unset (e.g. during local dev, or before the Owner approves ads on a
// brand-new service).
const ADSENSE_PUBLISHER_ID = process.env.ADSENSE_PUBLISHER_ID;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: SERVICE_NAME,
    template: `%s — ${SERVICE_NAME}`,
  },
  description: SERVICE_DESCRIPTION,
  openGraph: {
    title: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    url: APP_URL,
    siteName: SERVICE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
  },
  other: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { "google-site-verification": process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {ADSENSE_PUBLISHER_ID && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
