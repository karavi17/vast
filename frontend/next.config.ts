import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};

export default nextConfig;
