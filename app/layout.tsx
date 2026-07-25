import type { Metadata } from "next";
import { Fredoka, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
});

const SITE_URL = 'https://game.blackballs.site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "$BlackBalls — Degen Arcade",
  description: "Solana crash game & meme fighter arena. Rug or moon — your balls, your call.",
  applicationName: "$BlackBalls",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "$BlackBalls",
    title: "$BlackBalls — Degen Arcade",
    description: "Solana crash game & meme fighter arena. Rug or moon — your balls, your call.",
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
    description: "Solana crash game & meme fighter arena. Rug or moon — your balls, your call.",
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
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
