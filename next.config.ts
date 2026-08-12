import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      // Sprite atlases are content-hashed by the build tools, not the bundler, so pin
      // them here. They change only when the art changes.
      source: "/assets/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=3600, must-revalidate" }],
    },
  ],
};

export default nextConfig;
