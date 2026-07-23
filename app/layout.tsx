import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "NEXUS — Your Knowledge OS",
    template: "%s — NEXUS",
  },
  description:
    "NEXUS is an AI-native, spatial knowledge operating system that replaces bookmarks, wikis, and file systems. Save anything. Find everything. Know more.",
  keywords: [
    "knowledge management",
    "AI organization",
    "bookmarks",
    "spatial knowledge",
    "personal knowledge OS",
  ],
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
  openGraph: {
    title: "NEXUS — Your Knowledge OS",
    description: "The last app you'll ever need for information. AI-native knowledge management.",
    type: "website",
    siteName: "NEXUS",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEXUS — Your Knowledge OS",
    description: "The last app you'll ever need for information. AI-native knowledge management.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Analytics />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(222 47% 6%)",
              color: "hsl(210 40% 98%)",
              border: "1px solid hsl(217 33% 17%)",
              borderRadius: "0.75rem",
            },
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
