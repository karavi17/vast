import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:6789/api/:path*',
      },
    ];
  },
};

export default nextConfig;
