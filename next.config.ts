import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy is set per-request (with a nonce) in middleware.ts. These static headers
// cover the rest of the hardening.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // pdfkit loads bundled .afm font data via fs at runtime; keep these out of the bundle.
  serverExternalPackages: ["pdfkit", "exceljs"],
  // Pin the tracing root to this app (a stray lockfile in the parent folder otherwise
  // makes Next infer the wrong workspace root).
  outputFileTracingRoot: __dirname,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
