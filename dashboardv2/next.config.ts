import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard is reached through the Cloudflare tunnel at this host, so the
  // dev server must accept its cross-origin dev resources (Next 16 blocks them
  // by default — that's the HMR-handshake error when not on localhost).
  allowedDevOrigins: ["dashboard.hayateotsu.space", "localhost", "127.0.0.1", "host.docker.internal"],
  // Dev-only: stop the browser/tunnel from caching dev chunks under their stable URLs, so an edit
  // always shows on the next load without a hard refresh (production keeps normal immutable caching).
  async headers() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/_next/:path*", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
