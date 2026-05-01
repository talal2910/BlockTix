import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    unoptimized: true,
  },
  webpack: (config) => {
    config.module = config.module || {};
    config.module.exprContextCritical = false;
    return config;
  },
};

export default nextConfig;