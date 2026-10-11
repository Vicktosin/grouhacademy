import type { NextConfig } from "next";
import {
  isDomainMoveActive,
  KEEP_ON_OLD_DOMAIN,
  NEW_ORIGIN,
  OLD_HOST_CONDITION,
} from "./lib/domain-move";

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

// ProveSource (landing page social proof) loads provesrc.js from its CDN, talks
// to its client API, and pulls the popup font from fonts.bunny.net.
const proveSource = {
  script: "https://cdn.provesrc.com",
  connect: "https://client-api.provesrc.com",
  fonts: "https://fonts.bunny.net",
};

/**
 * The site's policy. `wasm` also lets pages compile WebAssembly (not run
 * eval): only the Practice Lab, whose backend simulator runs interns' code
 * in a WebAssembly sandbox in a Web Worker. Lab pages may also download
 * WordPress themes and plugins for the WordPress simulator, which runs
 * WordPress Playground (the site itself is in a playground.wordpress.net
 * frame).
 */
const csp = ({ wasm = false } = {}) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${googleAnalytics.script} ${metaPixel.script} ${proveSource.script}${isDev ? " 'unsafe-eval'" : ""}${wasm ? " 'wasm-unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' ${proveSource.fonts}`,
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `font-src 'self' data: ${proveSource.fonts}`,
  `connect-src 'self' ${supabaseUrl} ${supabaseRealtime} ${googleAnalytics.connect} ${metaPixel.connect} ${proveSource.connect}${wasm ? " https://downloads.wordpress.org https://playground.wordpress.net" : ""}${isDev ? " ws:" : ""}`,
  // 'self' for the Practice Lab preview (served over http in development).
  "frame-src 'self' https:",
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
  { key: "Content-Security-Policy", value: csp() },
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
  // The backend simulator's worker thread reads these on submit (they're
  // traced already; this makes sure they're always deployed).
  outputFileTracingIncludes: {
    "/api/internship/lab/[id]/submit": [
      "./node_modules/sql.js/dist/sql-wasm.wasm",
      "./node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm",
    ],
  },
  images: {
    remotePatterns: [
      // Public Storage images (avatars, thumbnails) from the live project
      // and from whichever project this build is connected to (e.g. the
      // development project when running locally).
      ...[
        ...new Set([
          "unqeyyxzmlpnjiwtmtov.supabase.co",
          ...(supabaseUrl.startsWith("https://") && !supabaseUrl.includes("*")
            ? [new URL(supabaseUrl).hostname]
            : []),
        ]),
      ].map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/**",
      })),
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
  },
  // Friendly aliases for the courses login and sign-up. These run before
  // the proxy, so they work for logged-out visitors too.
  async redirects() {
    return [
      // The old domain sends every page to the same page on the new one
      // (see lib/domain-move.ts).
      ...(isDomainMoveActive()
        ? [
            {
              source: `/:path((?!${KEEP_ON_OLD_DOMAIN.join("|")}).*)`,
              has: [OLD_HOST_CONDITION],
              destination: `${NEW_ORIGIN}/:path?moved=1`,
              permanent: process.env.DOMAIN_MOVE_PERMANENT === "true",
            },
          ]
        : []),
      {
        source: "/student/login",
        destination: "/courses/login",
        permanent: false,
      },
      {
        source: "/student/register",
        destination: "/courses/register",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      // On the old domain, the installed app's worker updates to one that
      // retires it (clears its caches and sends open pages to the new domain).
      beforeFiles: isDomainMoveActive()
        ? [{ source: "/sw.js", has: [OLD_HOST_CONDITION], destination: "/sw-retire.js" }]
        : [],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Office Life meetings let interns answer by speaking (the
        // browser's speech-to-text), so the dashboard may use the
        // microphone, for this site only; the browser still asks the
        // intern first. It's the whole dashboard, not just Office Life,
        // because moving between dashboard pages doesn't reload the page,
        // and the browser keeps the rules of the page loaded first.
        // Camera, location and payments stay off.
        source: "/internship/dashboard/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), payment=()",
          },
        ],
      },
      {
        // Practice interviews run in an embedded Tavus (Daily) video room,
        // which needs the camera and microphone. Allowed only here, only
        // for this site and that room; every other page keeps them off.
        // (A later header with the same key overrides the one above.)
        source: "/internship/dashboard/interview/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: [
              'camera=(self "https://tavus.daily.co")',
              'microphone=(self "https://tavus.daily.co")',
              'display-capture=(self "https://tavus.daily.co")',
              'autoplay=(self "https://tavus.daily.co")',
              "geolocation=()",
              "payment=()",
            ].join(", "),
          },
        ],
      },
      {
        // Practice Lab preview (app/lab-preview): runs interns' code in a
        // sandboxed iframe on this site only. It needs inline scripts and
        // eval (the intern's code and the exercise checks) and React from
        // this site; it can only be framed by this site and has no access
        // to the camera, microphone or anything else.
        source: "/lab-preview",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'none'",
              "script-src 'unsafe-inline' 'unsafe-eval' 'self'",
              "style-src 'unsafe-inline' https:",
              "img-src data: blob: https:",
              "font-src data: https:",
              "media-src data: blob: https:",
              "connect-src 'none'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        // Practice Lab pages and the scripts their Web Workers run from
        // (a worker follows its own script's policy) may compile
        // WebAssembly; see csp().
        source: "/internship/dashboard/lab/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp({ wasm: true }) }],
      },
      {
        source: "/admin/internship/lab/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp({ wasm: true }) }],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Content-Security-Policy", value: csp({ wasm: true }) }],
      },
      {
        // The backend simulator's WebAssembly files (1.2 MB): browsers keep
        // them for a year instead of checking for changes on every visit.
        // Their URLs carry the package versions, so upgrades still reach
        // everyone (see lib/backend-sim/browser-worker.ts).
        source: "/lab-runtime/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // React for the lab preview. The preview is a sandboxed frame with
        // no origin of its own, so loading these ES modules is a
        // cross-origin request. The folder name carries the version.
        source: "/lab-runtime/react-:version/:file*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Always revalidate the service worker so updates reach users.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
