import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: 'https://skinsense-backend-240757536793.us-central1.run.app/:path*',
      },
    ];
  },
  allowedDevOrigins: ['192.168.56.1', 'localhost'],
};

export default nextConfig;
