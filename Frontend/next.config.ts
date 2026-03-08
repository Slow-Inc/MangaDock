import type { NextConfig } from "next";
import os from "os";

/**
 * Dynamically collect ALL IPv4 addresses of the machine so that Next.js dev
 * mode allows HMR WebSocket connections from any of them (LAN, Radmin VPN, etc.).
 * Without this, accessing the dev server via a non-listed IP causes the HMR
 * connection to fail — React Fast Refresh can't coordinate state updates and
 * falls back to a full page reload, losing all client-side state (modals,
 * reader, translation patches, etc.).
 */
function getLocalIPv4Addresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const entry of iface) {
      if (entry.family === "IPv4" && !entry.internal) {
        ips.push(entry.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  // Allow cross-origin HMR / hot-reload requests when accessing the dev server
  // from other devices on the local network (e.g. 192.168.x.x, 10.x.x.x, Radmin VPN).
  allowedDevOrigins: getLocalIPv4Addresses(),
  images: {
    // All images are served through /api/proxy or /api/img-proxy (relative URLs on
    // the same server) so Next.js image optimizer can resize and convert to WebP/AVIF
    // without needing to know the original external hostname.
    localPatterns: [
      { pathname: "/api/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "books.google.com",
      },
      {
        protocol: "https",
        hostname: "books.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "uploads.mangadex.org",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // Facebook CDN domains for profile photos
      {
        protocol: "https",
        hostname: "graph.facebook.com",
      },
      {
        protocol: "https",
        hostname: "*.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
      },
      {
        protocol: "https",
        hostname: "scontent.fbcdn.net",
      },
      // Local image cache + uploads served by the backend.
      {
        protocol: "http",
        hostname: "localhost",
        port: "4001",
        pathname: "/**",
      },
      // Production backend via Cloudflare Tunnel domain
      {
        protocol: "https",
        hostname: "api.hayateotsu.space",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
