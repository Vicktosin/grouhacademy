import type { MetadataRoute } from "next";

// The installable app's manifest. It isn't Next's automatic app/manifest.ts,
// which would link it from every page: PwaManager links it only on app pages,
// so the public website can't be installed.
const manifest: MetadataRoute.Manifest = {
  id: "/app",
  name: "Grouh Academy",
  short_name: "Grouh Academy",
  description: "Your Grouh Academy internship and learning workspace.",
  start_url: "/app",
  scope: "/",
  display: "standalone",
  background_color: "#FFFFFF",
  theme_color: "#1C1D52",
  icons: [
    {
      src: "/icons/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
};

export function GET() {
  return Response.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
