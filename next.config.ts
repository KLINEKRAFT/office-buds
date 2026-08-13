import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      // Atlases are requested with ?v=<digest of every asset>, so a URL's contents can
      // never change and it is safe to cache one forever. The previous header promised
      // the same thing without the version, which meant a browser could hold props.json
      // for an hour and pair it with newly deployed code that expected a newer one.
      source: "/assets/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ],
};

export default nextConfig;
