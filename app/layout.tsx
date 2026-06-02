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
  icons: {
    icon: "https://raw.githubusercontent.com/cdcheng94-sudo/olcc-assets-circle-png/main/olcc-logo-circle.png",
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
