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
  // No explicit `icons` field — Next.js auto-detects app/icon.png and emits
  // the right <link rel="icon"> tag, sized for both the browser tab and
  // mobile home-screen.
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
