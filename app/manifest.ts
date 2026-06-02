import type { MetadataRoute } from "next";

/**
 * Web App Manifest. Picked up automatically by Next.js (App Router
 * convention: app/manifest.ts emits the right <link rel="manifest"> tag
 * pointing at the served JSON).
 *
 * Drives the "Add to Home Screen" experience on Android Chrome — name,
 * icon, splash colour, standalone display. iOS Safari uses
 * app/apple-icon.png separately for its home-screen icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "OLCC Books",
    short_name:       "OLCC Books",
    description:      "OLCC Technology internal bookkeeping system.",
    start_url:        "/dashboard",
    display:          "standalone",
    orientation:      "portrait",
    background_color: "#f4f6fa",     // matches --background (paper)
    theme_color:      "#0f2747",     // matches --primary  (navy)
    icons: [
      // Same source PNG at multiple declared sizes — browsers will scale
      // the underlying image to fit each slot. The file itself is a
      // high-resolution circle PNG so this rescales cleanly.
      { src: "/icon.png",       sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png",       sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
