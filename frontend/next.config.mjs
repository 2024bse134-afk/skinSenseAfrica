/** @type {import('next').NextConfig} */
const backendApiUrl = (
  process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000'
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
