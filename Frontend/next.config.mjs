/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 👇 This makes `next build` ignore ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

