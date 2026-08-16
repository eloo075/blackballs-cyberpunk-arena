import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

/** Self-hosted — avoids Google Fonts CDN (fixes fallback when fonts.googleapis.com is blocked). */
const fredoka = localFont({
  src: [
    { path: "./fonts/fredoka-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/fredoka-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fredoka-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fredoka-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-fredoka",
  display: "swap",
});
const jetbrains = localFont({
  src: [
    { path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});

const SITE_URL = 'https://game.blackballs.site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "$BlackBalls — Degen Arcade",
  description: "Solana crash game. Rug or moon — your balls, your call.",
  applicationName: "$BlackBalls",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "$BlackBalls",
    title: "$BlackBalls — Degen Arcade",
    description: "Solana crash game. Rug or moon — your balls, your call.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "$BlackBalls Degen Arcade",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "$BlackBalls — Degen Arcade",
    description: "Solana crash game. Rug or moon — your balls, your call.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className={`${fredoka.className} font-sans font-arcade antialiased`} suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
