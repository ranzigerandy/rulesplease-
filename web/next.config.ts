import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/product/:path*",
        has: [{ type: "host", value: "app.rulesplease.com" }],
        destination: "https://app.rulesplease.com/:path*",
        permanent: true,
      },
      {
        source: "/product/:path*",
        has: [{ type: "host", value: "rulesplease.com" }],
        destination: "https://app.rulesplease.com/:path*",
        permanent: true,
      },
      {
        source: "/product/:path*",
        has: [{ type: "host", value: "www.rulesplease.com" }],
        destination: "https://app.rulesplease.com/:path*",
        permanent: true,
      },
    ];
  },
  devIndicators: false,
  turbopack: {
    root: path.resolve(import.meta.dirname, ".."),
  },
};

export default nextConfig;
