import type { MetadataRoute } from "next";

/**
 * Web App Manifest. Picked up by Android Chrome's "Add to Home Screen"
 * (and "Install App" prompt) to brand the standalone shortcut.
 *
 * Icons point to /public/*.png (served at root paths), NOT app/icon.png —
 * Next's app/ icon convention serves the file under a hashed URL, which
 * makes manifest entries unreliable. Public assets are dead-simple.
 *
 * iOS Safari uses the apple-icon link tag (declared in layout.tsx metadata)
 * separately for its home-screen shortcut.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "OLCC Books",
    short_name:       "OLCC Books",
    description:      "OLCC Technology internal bookkeeping system.",
    start_url:        "/dashboard",
    display:          "standalone",
    orientation:      "portrait",
    background_color: "#f4f6fa",   // matches --background (paper)
    theme_color:      "#0f2747",   // matches --primary    (navy)
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };
}
