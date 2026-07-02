import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dashboard is reached through the Cloudflare tunnel at this host, so the
  // dev server must accept its cross-origin dev resources (Next 16 blocks them
  // by default — that's the HMR-handshake error when not on localhost).
  allowedDevOrigins: ["dashboard.hayateotsu.space"],
};

export default nextConfig;
