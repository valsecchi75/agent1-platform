import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  env: {
    // Expose version to client-side code as NEXT_PUBLIC_APP_VERSION.
    // Components use this to display the version badge dynamically —
    // no more hardcoded "Alpha 0.9" strings scattered through the codebase.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
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
