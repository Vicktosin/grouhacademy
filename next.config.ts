import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const supabaseRealtime = supabaseUrl.replace(/^https:/, "wss:");

// No nonces (see node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md), so inline scripts stay allowed. Images, media
// and frames accept any https source because course thumbnails, avatars and
// lesson videos are URLs entered by instructors and admins.
// Google Analytics loads gtag.js from Tag Manager and reports to these hosts.
const googleAnalytics = {
  script: "https://www.googletagmanager.com",
  connect:
    "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://www.google.com",
};

// Meta Pixel loads fbevents.js from connect.facebook.net and reports to facebook.com.
const metaPixel = {
  script: "https://connect.facebook.net",
  connect: "https://connect.facebook.net https://www.facebook.com",
};

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${googleAnalytics.script} ${metaPixel.script}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseRealtime} ${googleAnalytics.connect} ${metaPixel.connect}${isDev ? " ws:" : ""}`,
  "frame-src https:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Would rewrite http://localhost requests to https in development.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Browsers only honour HSTS over https, and it would pin localhost.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "unqeyyxzmlpnjiwtmtov.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Always revalidate the service worker so updates reach users.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
