import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Fix for @react-pdf/renderer in Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
