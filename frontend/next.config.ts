import type { NextConfig } from "next";

const apiOrigin = process.env.PLATEON_API_ORIGIN || "http://localhost:8081";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.PLATEON_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
