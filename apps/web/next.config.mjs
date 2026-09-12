/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@orchestr8/contracts"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig