/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@orchestr8/contracts"],

  // typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds used to be set
  // here, hiding 27 type errors in components that no page imported any more.
  // Those components are gone, so the build type-checks for real now — and a
  // regression fails the build instead of shipping.

  images: {
    unoptimized: true,
  },
}

export default nextConfig
