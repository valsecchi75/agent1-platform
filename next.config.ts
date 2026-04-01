import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "300mb",
    },
    // Allow large request bodies through Next.js proxy layer
    // Templates with preview images can exceed the default 10MB limit
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
