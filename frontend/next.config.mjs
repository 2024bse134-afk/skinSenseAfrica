/** @type {import('next').NextConfig} */
const backendApiUrl = (
  process.env.BACKEND_API_URL ?? 'https://skinsense-backend-240757536793.us-central1.run.app'
).replace(/\/+$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
