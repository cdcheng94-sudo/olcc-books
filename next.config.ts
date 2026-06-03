import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16's Cache Components is strict about async data in server
  // components — every await must be inside a <Suspense>. For our
  // redirect-only auth checks (app/page.tsx, app/(app)/layout.tsx) that
  // would mean restructuring without much real benefit. Disable for now;
  // we can revisit and adopt the new pattern as it matures.
  cacheComponents: false,

  // There's a stray package-lock.json one directory up (D:\CLAUDE workspace\).
  // Without this hint Turbopack infers the wrong workspace root and warns on
  // every boot. Pin the root to THIS project directory (process.cwd() when
  // `next dev` runs).
  turbopack: {
    root: process.cwd(),
  },

  // @react-pdf/renderer carries native font assets + a large dep tree. Tell
  // Next to load it via require() at runtime instead of bundling it into the
  // serverless function — keeps function size under Vercel's Hobby limit.
  serverExternalPackages: ["@react-pdf/renderer", "googleapis"],
};

export default nextConfig;
