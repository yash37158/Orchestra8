/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@orchestr8/contracts"],

  // Standalone output: the container ships a server plus only the node_modules
  // it actually reached, instead of the whole workspace. Without this the image
  // carries the entire monorepo dependency tree.
  output: "standalone",
  // The workspace root, so tracing follows symlinks into packages/contracts
  // rather than stopping at apps/web and shipping a build that cannot resolve it.
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,

  // typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds used to be set
  // here, hiding 27 type errors in components that no page imported any more.
  // Those components are gone, so the build type-checks for real now — and a
  // regression fails the build instead of shipping.

  images: {
    unoptimized: true,
  },
}

export default nextConfig
