import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  env: {
    // Expose version to client-side code as NEXT_PUBLIC_APP_VERSION.
    // Components use this to display the version badge dynamically —
    // no more hardcoded "Alpha 0.9" strings scattered through the codebase.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    // Build info injected by scripts/generate-build-info.js (pre-build step).
    // Falls back to 'dev' when running in dev mode without a prior build.
    NEXT_PUBLIC_BUILD_COMMIT: process.env.NEXT_PUBLIC_BUILD_COMMIT || 'dev',
    NEXT_PUBLIC_BUILD_BRANCH: process.env.NEXT_PUBLIC_BUILD_BRANCH || 'local',
    NEXT_PUBLIC_BUILD_DATE: process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString(),
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
