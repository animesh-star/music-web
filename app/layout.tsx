import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://music-web-nine-bay.vercel.app"),
  title: "Echoa • Retro Music Experience",
  description: "A single-page music experience. Listen to lofi monsoon cafe beats, 90s street radio cassettes, and midnight synthwave.",
  openGraph: {
    title: "Echoa • Retro Music Experience",
    description: "Immersive single-page nostalgia music experience featuring interactive vinyl player, lofi beats, 90s street radio, and synthwave scenes.",
    images: ["/bg/scene-wide.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Echoa Music",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-rose-500/30 selection:text-rose-200">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
