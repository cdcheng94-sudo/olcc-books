import type { Metadata } from "next";
import { LangProvider } from "@/components/LangProvider";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "OLCC Books",
  description: "OLCC Technology Sdn Bhd internal bookkeeping system.",

  // Explicit icon + manifest references. Files live in /public so the URLs
  // stay stable (the app/icon convention hashes the URL, which is fine
  // for the browser tab but breaks manifest references). Both /icon.png
  // and /apple-icon.png are the same OLCC circle logo at high resolution
  // — browsers handle the rescaling.
  icons: {
    icon: [
      { url: "/icon.png", sizes: "any",     type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [{ url: "/icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
